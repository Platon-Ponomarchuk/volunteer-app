import { clsx } from 'clsx'
import styles from './Icon.module.scss'

import BellOnSvg from '@/assets/icons/BellOn.svg?raw'
import CalendarSvg from '@/assets/icons/Calendar.svg?raw'
import CircleAlertSvg from '@/assets/icons/CircleAlert.svg?raw'
import CircleCheckSvg from '@/assets/icons/CircleCheck.svg?raw'
import CircleQuestionSvg from '@/assets/icons/CircleQuestion.svg?raw'
import DarkSvg from '@/assets/icons/Dark.svg?raw'
import FaceFrownSvg from '@/assets/icons/FaceFrown.svg?raw'
import FaceMehSvg from '@/assets/icons/FaceMeh.svg?raw'
import FaceSmileSvg from '@/assets/icons/FaceSmile.svg?raw'
import FilterSvg from '@/assets/icons/Filter.svg?raw'
import HeartSvg from '@/assets/icons/Heart.svg?raw'
import LightSvg from '@/assets/icons/Light.svg?raw'
import LocationOnSvg from '@/assets/icons/LocationOn.svg?raw'
import LoginSvg from '@/assets/icons/Login.svg?raw'
import LogoutSvg from '@/assets/icons/Logout.svg?raw'
import ReadSvg from '@/assets/icons/Read.svg?raw'
import SearchSvg from '@/assets/icons/Search.svg?raw'
import UserSvg from '@/assets/icons/User.svg?raw'
import ViewTimelineSvg from '@/assets/icons/ViewTimeline.svg?raw'

const icons: Record<string, string> = {
  BellOn: BellOnSvg,
  Calendar: CalendarSvg,
  CircleAlert: CircleAlertSvg,
  CircleCheck: CircleCheckSvg,
  CircleQuestion: CircleQuestionSvg,
  Dark: DarkSvg,
  FaceFrown: FaceFrownSvg,
  FaceMeh: FaceMehSvg,
  FaceSmile: FaceSmileSvg,
  Filter: FilterSvg,
  Heart: HeartSvg,
  Light: LightSvg,
  LocationOn: LocationOnSvg,
  Login: LoginSvg,
  Logout: LogoutSvg,
  Read: ReadSvg,
  Search: SearchSvg,
  User: UserSvg,
  ViewTimeline: ViewTimelineSvg,
}

export type IconName = keyof typeof icons

export interface IconProps {
  name: IconName
  className?: string
  size?: number
  'aria-hidden'?: boolean
}

export function Icon({ name, className, size = 24, 'aria-hidden': ariaHidden = true }: IconProps) {
  const svg = icons[name]
  if (!svg) return null
  const sizeStyle = size !== 24 ? { width: size, height: size } : undefined
  return (
    <span
      className={clsx(styles.icon, className)}
      style={sizeStyle}
      aria-hidden={ariaHidden}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
