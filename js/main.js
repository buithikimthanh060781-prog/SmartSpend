import { supabase } from './supabase.js';

const form = document.getElementById('lead-form');
const statusEl = document.getElementById('lead-status');
const submitBtn = form.querySelector('button[type="submit"]');

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const payload = {
    full_name: String(data.get('full_name') || '').trim(),
    email: String(data.get('email') || '').trim(),
    note: String(data.get('note') || '').trim() || null,
  };

  submitBtn.disabled = true;
  setStatus('Đang gửi...', 'info');

  const { error } = await supabase.from('smartspend_leads').insert(payload);

  submitBtn.disabled = false;
  if (!error) {
    form.reset();
    setStatus('Cảm ơn bạn! SmartSpend sẽ báo tin cho bạn khi ra mắt.', 'success');
  } else if (error.code === '23505') {
    setStatus('Email này đã đăng ký rồi. Cảm ơn bạn đã quan tâm!', 'success');
  } else if (error.code === '23514') {
    setStatus('Thông tin chưa hợp lệ, vui lòng kiểm tra lại họ tên và email.', 'error');
  } else {
    console.error(error);
    setStatus('Chưa gửi được. Vui lòng thử lại sau ít phút.', 'error');
  }
});
