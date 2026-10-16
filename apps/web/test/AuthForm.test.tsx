import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthForm } from '../src/components/AuthForm';

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
});
