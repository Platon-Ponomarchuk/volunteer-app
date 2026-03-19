"""
Нагрузочное тестирование API приложения (Locust).

URL бэкенда по умолчанию берётся из .env (VITE_API_BASE_URL или API_BASE_URL) в корне проекта.
Переопределить: python3 -m locust -f locustfile.py --host=http://your-server:3000

Запуск (бэкенд уже на сервере, URL в .env):
  cd load && pip3 install -r requirements.txt
  python3 -m locust -f locustfile.py

С веб-интерфейсом: откройте http://localhost:8089 после запуска.
Без веб-интерфейса: python3 -m locust -f locustfile.py --headless -u 10 -r 2 -t 30s
"""

import os
import random
import string
from pathlib import Path

from dotenv import load_dotenv
from locust import HttpUser, task, between

# Загружаем .env из корня проекта (родитель папки load)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

# URL бэкенда: из .env или localhost по умолчанию
DEFAULT_HOST = (
    os.getenv("VITE_API_BASE_URL") or os.getenv("API_BASE_URL") or "http://localhost:3000"
).rstrip("/")


def random_string(length=8):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))


class ApiUser(HttpUser):
    """Пользователь, имитирующий типичные запросы к API."""

    host = DEFAULT_HOST
    wait_time = between(0.5, 2.0)

    def on_start(self):
        """Опционально: один раз при старте виртуального пользователя."""
        self._event_ids = []
        self._user_ids = []

    @task(10)
    def get_events(self):
        """Список мероприятий — самый частый сценарий."""
        self.client.get("/events", name="/events [list]")

    @task(8)
    def get_events_with_filters(self):
        """Список мероприятий с фильтрами."""
        params = {}
        if random.random() > 0.5:
            params["_limit"] = str(random.randint(5, 20))
        if random.random() > 0.7:
            params["status"] = random.choice(["draft", "published", "cancelled"])
        self.client.get("/events", params=params or None, name="/events [filtered]")

    @task(6)
    def get_categories(self):
        """Категории (часто запрашиваются для фильтров)."""
        self.client.get("/categories", name="/categories")

    @task(5)
    def get_event_by_id(self):
        """Просмотр одного мероприятия (если есть сохранённые id)."""
        if self._event_ids:
            eid = random.choice(self._event_ids)
            self.client.get(f"/events/{eid}", name="/events/:id")
        else:
            self.client.get("/events", name="/events [list]")
            # После первого запроса можно было бы парсить id из ответа — упрощаем

    @task(4)
    def get_users(self):
        """Список пользователей (например для админки/организаторов)."""
        self.client.get("/users", name="/users [list]")

    @task(3)
    def get_applications(self):
        """Список заявок."""
        params = {}
        if random.random() > 0.5:
            params["_limit"] = "20"
        self.client.get("/applications", params=params or None, name="/applications")

    @task(2)
    def auth_login(self):
        """Попытка входа (часто неуспешная при случайных данных — нормально для нагрузки)."""
        self.client.post(
            "/auth",
            json={
                "email": f"loaduser_{random_string(6)}@test.loc",
                "password": random_string(12),
            },
            name="/auth [login]",
        )

    @task(1)
    def auth_register(self):
        """Регистрация нового пользователя."""
        email = f"load_{random_string(8)}@test.loc"
        self.client.post(
            "/auth/register",
            json={
                "email": email,
                "password": random_string(12),
                "name": f"Load User {random_string(4)}",
                "role": random.choice(["volunteer", "organizer"]),
            },
            name="/auth/register",
        )

    @task(1)
    def get_event_requests(self):
        """Запросы на публикацию мероприятий."""
        self.client.get("/eventRequests", name="/eventRequests")

    @task(1)
    def get_notifications(self):
        """Уведомления (с userId если нужен контекст — без для простоты)."""
        self.client.get("/notifications", name="/notifications")
