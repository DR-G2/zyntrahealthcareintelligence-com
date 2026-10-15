import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const insert = vi.fn();
vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ insert }) } }));
import PracticeOsce from './PracticeOsce';

beforeEach(() => insert.mockReset());
describe('OSCE interest persistence', () => {
  it('submits the existing interest payload and confirms only a successful save', async () => {
    insert.mockResolvedValue({ error: null });
    render(<MemoryRouter><PracticeOsce /></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'candidate@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record interest' }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(insert).toHaveBeenCalledWith({ name: 'candidate@example.test', email: 'candidate@example.test', category: 'osce_interest', message: 'OSCE interest from Practice' });
  });
  it('preserves the email and permits retry after a failed save', async () => {
    insert.mockResolvedValue({ error: { message: 'denied' } });
    render(<MemoryRouter><PracticeOsce /></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'candidate@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record interest' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('textbox')).toHaveValue('candidate@example.test');
    expect(screen.getByRole('button', { name: 'Record interest' })).not.toBeDisabled();
  });
});