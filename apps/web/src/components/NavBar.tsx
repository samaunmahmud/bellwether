import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import { NavLink, useNavigate } from 'react-router-dom';
import { LOG_OUT, ME_QUERY } from '../graphql/auth';

export function NavBar() {
  const client = useApolloClient();
  const navigate = useNavigate();
  const { data } = useQuery<{ me: { id: string; email: string } | null }>(ME_QUERY);
  const [logOut] = useMutation(LOG_OUT);
  const me = data?.me;

  async function handleLogOut() {
    await logOut();
    // Drop everything cached for this user and re-ask who is signed in.
    await client.resetStore();
    navigate('/');
  }

  return (
    <header className="topbar">
      <NavLink to="/" className="brand">
        Bellwether
      </NavLink>
      <nav>
        <NavLink to="/" end>
          Forecast
        </NavLink>
        {me ? (
          <>
            <NavLink to="/farms">My farms</NavLink>
            <NavLink to="/animals">My pets</NavLink>
            <span className="muted topbar__user">{me.email}</span>
            <button type="button" className="link-button" onClick={handleLogOut}>
              Log out
            </button>
          </>
        ) : (
          data && <NavLink to="/login">Log in</NavLink>
        )}
      </nav>
    </header>
  );
}
