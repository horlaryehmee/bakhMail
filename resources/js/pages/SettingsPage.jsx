import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { KeyRound, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function SettingsPage() {
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const [setupData, setSetupData] = useState(null);
  const [qrUrl, setQrUrl] = useState('');
  const [enableCode, setEnableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);

  useEffect(() => {
    if (setupData?.otpauth_uri) {
      QRCode.toDataURL(setupData.otpauth_uri).then(setQrUrl).catch(() => setQrUrl(''));
    }
  }, [setupData]);

  async function beginSetup() {
    try {
      const response = await api.get('/api/2fa/setup');
      setSetupData(response);
      setRecoveryCodes([]);
      setEnableCode('');
      setModalOpen(true);
    } catch {
      toast.error('Could not start two-factor setup');
    }
  }

  async function enableTwoFactor() {
    try {
      const response = await api.post('/api/2fa/enable', { code: enableCode });
      setUser({ ...user, two_factor_enabled: true });
      setEnableCode('');
      setRecoveryCodes(response.recovery_codes || []);
      toast.success('Two-factor enabled');
    } catch {
      toast.error('Could not enable two-factor');
    }
  }

  async function disableTwoFactor() {
    if (!disablePassword.trim()) {
      toast.error('Enter your current password to disable two-factor');
      return;
    }

    try {
      await api.post('/api/2fa/disable', { current_password: disablePassword });
      setUser({ ...user, two_factor_enabled: false });
      setDisablePassword('');
      toast.success('Two-factor disabled');
    } catch (error) {
      const message =
        error.payload?.errors?.current_password?.[0] ||
        error.payload?.message ||
        'Could not disable two-factor';
      toast.error(message);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setRecoveryCodes([]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account settings"
        title="Secure operator access and keep deliverability guardrails visible."
        description="Use this area to manage two-factor authentication and review the operational checks that protect sending reputation."
        stats={[
          { label: '2FA', value: user?.two_factor_enabled ? 'On' : 'Off' },
          { label: 'Role', value: user?.role || 'standard' },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Account security</p>
              <h2 className="text-3xl font-semibold text-slate-950">Two-factor authentication</h2>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] bg-slate-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Authenticator app protection</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Require a TOTP challenge after password authentication for this operator identity.
                </p>
              </div>
              <StatusBadge status={user?.two_factor_enabled ? 'enabled' : 'disabled'} tone={user?.two_factor_enabled ? 'emerald' : 'slate'} />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button className="primary-button" type="button" onClick={beginSetup}>
                <KeyRound size={16} />
                Set up authenticator
              </button>
            </div>

            {user?.two_factor_enabled ? (
              <div className="mt-6 border-t border-slate-200 pt-5">
                <label className="field-shell">
                  <span className="field-label">Current password to disable</span>
                  <input className="field-input" type="password" value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} />
                </label>
                <button className="ghost-button mt-3" type="button" onClick={disableTwoFactor} disabled={!disablePassword.trim()}>
                  Disable two-factor
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="surface-card p-5 sm:p-6">
          <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Deliverability notes</p>
          <h3 className="text-2xl font-semibold text-slate-950">Operational checklist</h3>

          <div className="mt-5 space-y-3">
            {[
              'Verify SPF, DKIM, and DMARC before volume ramp.',
              'Use warm-up automation on new accounts before attaching them to multi-account rotation.',
              'Keep bounce and unsubscribe suppression active to protect domain reputation.',
            ].map((line) => (
              <div key={line} className="surface-card-muted px-4 py-4 text-sm leading-6 text-slate-600">
                {line}
              </div>
            ))}
          </div>

          <div className="mt-6 surface-card-muted p-4">
            <p className="text-sm font-semibold text-slate-950">Current operator</p>
            <p className="mt-2 text-sm text-slate-500">{user?.name}</p>
            <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
          </div>
        </section>
      </div>

      <Modal
        open={modalOpen}
        title="Set up two-factor authentication"
        onClose={closeModal}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button className="ghost-button" type="button" onClick={closeModal}>
              {recoveryCodes.length ? 'Done' : 'Cancel'}
            </button>
            {!recoveryCodes.length ? (
              <button className="primary-button" type="button" onClick={enableTwoFactor}>
                Enable 2FA
              </button>
            ) : null}
          </div>
        }
      >
        {recoveryCodes.length ? (
          <div className="space-y-4">
            <div className="surface-card-muted p-5">
              <p className="text-sm font-semibold text-slate-950">Recovery codes</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Store these codes safely. Each code can be used once if you lose access to your authenticator device.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {recoveryCodes.map((code) => (
                <div key={code} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">
                  {code}
                </div>
              ))}
            </div>
          </div>
        ) : setupData ? (
          <div className="space-y-4">
            {qrUrl ? <img src={qrUrl} alt="2FA QR code" className="mx-auto h-56 w-56 rounded-3xl border border-slate-200 bg-white p-4" /> : null}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Secret: <span className="font-mono text-slate-900">{setupData.secret}</span>
            </div>
            <label className="field-shell">
              <span className="field-label">Authenticator code</span>
              <input className="field-input" value={enableCode} onChange={(event) => setEnableCode(event.target.value)} />
            </label>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
