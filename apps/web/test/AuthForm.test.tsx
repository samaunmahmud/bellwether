import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthForm, passwordStrength } from '../src/components/AuthForm';

async function fillIn(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
}

describe('AuthForm', () => {
  it('signs up with the trimmed email and the password', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AuthForm mode="signup" onSubmit={onSubmit} />);

    await fillIn('  ann@example.com ', 'x'.repeat(10));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(onSubmit).toHaveBeenCalledWith({ email: 'ann@example.com', password: 'x'.repeat(10) });
  });

  it('asks for at least 10 characters when signing up (A11)', async () => {
    const onSubmit = vi.fn();
    render(<AuthForm mode="signup" onSubmit={onSubmit} />);

    await fillIn('ann@example.com', 'x'.repeat(9));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByRole('alert')).toHaveTextContent('at least 10 characters');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not check password length when logging in', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AuthForm mode="login" onSubmit={onSubmit} />);

    await fillIn('ann@example.com', 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(onSubmit).toHaveBeenCalledWith({ email: 'ann@example.com', password: 'short' });
  });

  it('shows the error from the server', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Email or password is incorrect'));
    render(<AuthForm mode="login" onSubmit={onSubmit} />);

    await fillIn('ann@example.com', 'wrong password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });

  it('shows and hides the password', async () => {
    render(<AuthForm mode="login" onSubmit={vi.fn()} />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('warns when Caps Lock is on', async () => {
    render(<AuthForm mode="login" onSubmit={vi.fn()} />);
    const input = screen.getByLabelText('Password');
    input.focus();
    const event = new KeyboardEvent('keydown', { key: 'A', bubbles: true });
    Object.defineProperty(event, 'getModifierState', { value: (k: string) => k === 'CapsLock' });
    input.dispatchEvent(event);
    expect(await screen.findByText(/Caps Lock is on/)).toBeInTheDocument();
  });

  it('rates the new password as it is typed, in words', async () => {
    render(<AuthForm mode="signup" onSubmit={vi.fn()} />);
    const input = screen.getByLabelText('Password');
    await userEvent.type(input, 'short');
    expect(screen.getByText(/Too short/)).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, 'aaaaaaaaaa');
    expect(screen.getByText(/Weak/)).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, 'correct horse battery');
    expect(screen.getByText(/Strong/)).toBeInTheDocument();
  });
});

describe('passwordStrength', () => {
  it.each([
    ['', 0, 'Too short'],
    ['abc', 0, 'Too short'],
    ['aaaaaaaaaa', 1, 'Weak'],
    ['abcdefgh12', 2, 'Fair'],
    ['Abcdefgh12!x', 3, 'Good'],
    ['correct horse battery', 4, 'Strong'],
  ])('%j → %i %s', (password, score, label) => {
    expect(passwordStrength(password)).toEqual({ score, label });
  });
});
