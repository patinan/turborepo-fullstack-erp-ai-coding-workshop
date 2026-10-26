import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { apiError, mockApi } from '@/test/mock-api';
import { LoginPage } from './login';

const admin = { id: '1', username: 'admin01', name: 'Admin 01', role: 'ADMIN', store: null };

function renderLogin(url = '/login') {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <p>Home page</p> },
      { path: '/orders', element: <p>Orders page</p> },
    ],
    { initialEntries: [url] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

async function signIn(username: string, password: string) {
  fireEvent.change(await screen.findByLabelText('ชื่อผู้ใช้'), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signs in and goes to the redirect target', async () => {
    const fetch = mockApi({ 'GET /auth/me': { user: null }, 'POST /auth/login': admin });

    renderLogin('/login?redirect=%2Forders');
    await signIn('admin01', 'password');

    expect(await screen.findByText('Orders page')).toBeInTheDocument();
    const login = fetch.mock.calls.find(([request]) => request.method === 'POST')![0];
    await expect(login.json()).resolves.toEqual({ username: 'admin01', password: 'password' });
  });

  it('shows an error for wrong credentials', async () => {
    mockApi({
      'GET /auth/me': { user: null },
      'POST /auth/login': apiError('INVALID_CREDENTIALS'),
    });

    renderLogin();
    await signIn('admin01', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  });

  it('fills in a demo account', async () => {
    mockApi({ 'GET /auth/me': { user: null } });

    renderLogin();
    fireEvent.click(await screen.findByText('staff_b01'));

    expect(screen.getByLabelText('ชื่อผู้ใช้')).toHaveValue('staff_b01');
    expect(screen.getByLabelText('รหัสผ่าน')).toHaveValue('password');
  });

  it('ignores a redirect to another site', async () => {
    mockApi({ 'GET /auth/me': { user: admin } });

    renderLogin('/login?redirect=%2F%2Fevil.example');

    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });
});
