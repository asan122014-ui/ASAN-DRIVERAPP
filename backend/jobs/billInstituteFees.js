import { ensureInstituteFeeInvoices } from '../institute/fixedFees.js';
export function startInstituteFeeBilling() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await ensureInstituteFeeInvoices({}); }
    catch (error) { console.error('Institute monthly billing failed:', error.name); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(tick, 3600000);
  timer.unref();
  return timer;
}
