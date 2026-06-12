import { clsx } from 'clsx'
import { Icon } from '../Icon'
import styles from './FileUpload.module.scss'

export interface FileUploadProps {
  id: string
  label: string
  file: File | null
  accept?: string
  disabled?: boolean
  hint?: string
  onChange: (file: File | null) => void
  className?: string
}

export function FileUpload({
  id,
  label,
  file,
  accept = 'image/jpeg,image/png,image/webp',
  disabled,
  hint = 'PNG, JPG или WebP до 5 MB',
  onChange,
  className,
}: FileUploadProps) {
  return (
    <div className={clsx(styles.field, className)}>
      <span className={styles.label}>{label}</span>
      <label className={clsx(styles.dropzone, disabled && styles.disabled)} htmlFor={id}>
        <input
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          className={styles.input}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        <span className={styles.iconWrap}>
          <Icon name={file ? 'CircleCheck' : 'Read'} size={22} />
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{file ? file.name : 'Выбрать файл'}</span>
          <span className={styles.hint}>{file ? 'Файл будет загружен после сохранения' : hint}</span>
        </span>
      </label>
      {file && (
        <button type="button" className={styles.clear} onClick={() => onChange(null)} disabled={disabled}>
          Убрать файл
        </button>
      )}
    </div>
  )
}
