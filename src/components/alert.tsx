import { AlertCircle, AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './alert.module.css';

export interface AlertProps {
  tone?: 'danger' | 'warning';
  title: string;
  children?: ReactNode;
  /** Acción opcional, por ejemplo un botón "Reintentar". */
  action?: ReactNode;
  className?: string;
}

/** Aviso en línea (`role="alert"`): título, texto de ayuda y acción opcional. */
export function Alert({ tone = 'danger', title, children, action, className }: AlertProps) {
  const Icon = tone === 'danger' ? AlertCircle : AlertTriangle;
  return (
    <div role="alert" className={cx(styles.alert, styles[tone], className)}>
      <Icon className={styles.icon} aria-hidden="true" size={20} />
      <div className={styles.body}>
        <span className={styles.title}>{title}</span>
        {children && <span className={styles.text}>{children}</span>}
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  );
}
