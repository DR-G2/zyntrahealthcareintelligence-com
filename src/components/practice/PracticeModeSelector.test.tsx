import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PracticeModeSelector } from './PracticeModeSelector';

describe('PracticeModeSelector availability', () => {
  it('presents Normal MCQ as available and the only selected practice mode', () => {
    render(<PracticeModeSelector value="drill" onChange={vi.fn()} />);
    expect(screen.getByText('Normal MCQ')).toBeInTheDocument();
    expect(screen.getByText('Available now')).toBeInTheDocument();
    expect(screen.getByText('Selected for practice')).toBeInTheDocument();
  });

  it.each(['AMC Exam Mode', 'Nudge'])('marks %s unavailable without a start control', (name) => {
    const onChange = vi.fn();
    render(<PracticeModeSelector value="drill" onChange={onChange} />);
    expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getAllByText('Under Construction · Live Soon').length).toBe(2);
    expect(screen.getByLabelText(new RegExp(name + '.*Unavailable'))).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: new RegExp(name, 'i') })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps upcoming mode panels non-interactive', () => {
    const onChange = vi.fn();
    render(<PracticeModeSelector value="drill" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/AMC Exam Mode.*Unavailable/));
    fireEvent.click(screen.getByLabelText(/Nudge.*Unavailable/));
    expect(onChange).not.toHaveBeenCalled();
  });
});
