import { supabase } from './supabase.js';

const $ = (id) => document.getElementById(id);
const loginView = $('login-view');
const listView = $('list-view');
const loginForm = $('login-form');
const loginStatus = $('login-status');
const listStatus = $('list-status');
const logoutBtn = $('logout-btn');
const body = $('leads-body');
const countEl = $('count');
const searchEl = $('search');

let leads = [];

function setStatus(el, message, type) {
  el.textContent = message;
  el.dataset.type = type;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function cell(text, className) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const rows = q
    ? leads.filter((l) => l.full_name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q))
    : leads;

  countEl.textContent = rows.length;
  body.replaceChildren();

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = cell(leads.length ? 'Không có kết quả phù hợp.' : 'Chưa có ai đăng ký.', 'empty');
    td.colSpan = 5;
    tr.append(td);
    body.append(tr);
    return;
  }

  rows.forEach((l, i) => {
    const tr = document.createElement('tr');
    tr.append(
      cell(i + 1, 'num'),
      cell(l.full_name),
      cell(l.email),
      cell(l.note || '', 'note'),
      cell(formatDate(l.created_at), 'date'),
    );
    body.append(tr);
  });
}

async function loadLeads() {
  setStatus(listStatus, 'Đang tải...', 'info');
  const { data, error } = await supabase
    .from('smartspend_leads')
    .select('id, full_name, email, note, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    leads = [];
    render();
    setStatus(listStatus, 'Không tải được danh sách. Tài khoản này cần có quyền ADMIN trong bảng profiles.', 'error');
    return;
  }
  leads = data;
  setStatus(listStatus, '', 'info');
  render();
}

function showList(show) {
  loginView.hidden = show;
  listView.hidden = !show;
  logoutBtn.hidden = !show;
}

async function checkSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    showList(true);
    loadLeads();
  } else {
    showList(false);
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  const submit = loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setStatus(loginStatus, 'Đang đăng nhập...', 'info');

  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get('email') || '').trim(),
    password: String(form.get('password') || ''),
  });

  submit.disabled = false;
  if (error) {
    setStatus(loginStatus, 'Email hoặc mật khẩu không đúng.', 'error');
    return;
  }
  loginForm.reset();
  setStatus(loginStatus, '', 'info');
  checkSession();
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  leads = [];
  render();
  showList(false);
});

$('refresh-btn').addEventListener('click', loadLeads);
searchEl.addEventListener('input', render);

$('export-btn').addEventListener('click', () => {
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const lines = [['Họ tên', 'Email', 'Mong muốn', 'Ngày đăng ký'].map(esc).join(',')];
  leads.forEach((l) => lines.push([l.full_name, l.email, l.note, l.created_at].map(esc).join(',')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'smartspend-leads.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

checkSession();
