import clsx from 'clsx';

const toneClasses = {
  blue: 'status-badge--blue',
  emerald: 'status-badge--emerald',
  amber: 'status-badge--amber',
  rose: 'status-badge--rose',
  slate: 'status-badge--slate',
};

const statusToTone = {
  active: 'blue',
  queued: 'amber',
  scheduled: 'amber',
  running: 'blue',
  sending: 'blue',
  draft: 'slate',
  paused: 'amber',
  completed: 'emerald',
  sent: 'emerald',
  delivered: 'emerald',
  replied: 'emerald',
  connected: 'emerald',
  healthy: 'emerald',
  disabled: 'slate',
  inactive: 'slate',
  failed: 'rose',
  bounced: 'rose',
  error: 'rose',
  unsubscribed: 'rose',
};

function titleize(value) {
  return String(value || 'Unknown')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function StatusBadge({ status, tone, className }) {
  const normalized = String(status || '').toLowerCase();
  const resolvedTone = tone || statusToTone[normalized] || 'slate';

  return (
    <span className={clsx('status-badge', toneClasses[resolvedTone], className)}>
      {titleize(status || 'Unknown')}
    </span>
  );
}
