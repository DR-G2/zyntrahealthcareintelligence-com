import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const submitPieAnswer = vi.fn();
const startPieSession = vi.fn();
vi.mock('@/lib/pie/pie-practice-client', () => ({
  startPieSession: (...a: unknown[]) => startPieSession(...a),
  submitPieAnswer: (...a: unknown[]) => submitPieAnswer(...a),
  nextPieQuestion: vi.fn(async () => null),
  finishPieSession: vi.fn(async () => []),
  resumePieSession: vi.fn(),
}));
vi.mock('@/lib/pie/pie-engine-client', () => ({ syncPieEngine: vi.fn(async () => ({})) }));
vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ upsert: async () => ({}), delete: () => ({ eq: async () => ({}) }) }) } }));

import { PieDrillSession } from './PieDrillSession';

const question = (pos: number) => ({ question_id: `q${pos}`, question_position: pos, stem: `Stem ${pos}`, options: ['One', 'Two', 'Three', 'Four', 'Five'], answered_at: null, version: 1 });

function setup(mode: 'recharge' | 'no-change' | 'full-mock', count = 2) {
  startPieSession.mockResolvedValue({ sessionId: 's1', questions: Array.from({ length: count }, (_, i) => question(i + 1)) });
  render(<MemoryRouter><PieDrillSession config={{ mode, questionCount: count }} onFinish={vi.fn()} /></MemoryRouter>);
  return screen.findByTestId('pie-stem');
}
const option = (letter: string) => screen.getAllByRole('button', { pressed: false }).concat(screen.queryAllByRole('button', { pressed: true }))
  .find(b => b.textContent?.startsWith(letter) && !b.getAttribute('aria-label'))!;

beforeEach(() => { submitPieAnswer.mockReset(); startPieSession.mockReset(); });

describe('PieDrillSession rules', () => {
  it('does not advance or save without confidence, and shows the required message', async () => {
    await setup('recharge');
    fireEvent.click(option('A'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(await screen.findByText('Select your confidence level to continue.')).toBeInTheDocument();
    expect(submitPieAnswer).not.toHaveBeenCalled();
    expect(screen.getByText('Stem 1')).toBeInTheDocument();
  });

  it('keeps the current question and selection when saving fails', async () => {
    submitPieAnswer.mockRejectedValue(new Error('network'));
    await setup('recharge');
    fireEvent.click(option('B'));
    fireEvent.click(screen.getByRole('radio', { name: 'Confidence 3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(submitPieAnswer).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Stem 1')).toBeInTheDocument();
    expect(option('B')).toHaveAttribute('aria-pressed', 'true');
  });

  it('records every change in with-change mode', async () => {
    submitPieAnswer.mockResolvedValue(undefined);
    await setup('recharge');
    fireEvent.click(option('A')); fireEvent.click(option('C'));
    fireEvent.click(screen.getByRole('radio', { name: 'Confidence 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(submitPieAnswer).toHaveBeenCalled());
    expect(submitPieAnswer.mock.calls[0][0]).toMatchObject({ selectedAnswer: 'C', changeSequence: ['A', 'C'], confidenceLevel: 4 });
  });

  it.each(['no-change', 'full-mock'] as const)('ignores a second option click in %s mode', async (mode) => {
    await setup(mode);
    fireEvent.click(option('A')); fireEvent.click(option('C'));
    expect(option('A')).toHaveAttribute('aria-pressed', 'true');
    expect(option('C')).toHaveAttribute('aria-pressed', 'false');
  });

  it('rule-out blocks choosing that option, can be undone, and never applies to the selected answer', async () => {
    await setup('recharge');
    fireEvent.click(screen.getByRole('button', { name: 'Rule out option B' }));
    expect(option('B')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Restore option B' }));
    expect(option('B')).not.toBeDisabled();
    fireEvent.click(option('A'));
    expect(screen.getByRole('button', { name: 'Rule out option A' })).toBeDisabled();
  });

  it('hides Back in the mock and asks for confirmation before finishing', async () => {
    await setup('full-mock', 1);
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /finish test/i }));
    expect(await screen.findByText('Finish the mock exam?')).toBeInTheDocument();
  });

  it('starts sessions with the question count only (topics are not sent)', async () => {
    await setup('recharge', 2);
    expect(startPieSession).toHaveBeenCalledWith(2, undefined, 'normal_mcq');
  });
});
