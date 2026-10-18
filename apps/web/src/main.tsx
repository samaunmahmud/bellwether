import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { applyStoredPalette } from './components/PalettePicker';
import { registerOffline } from './offline/registerOffline';
import { routerFuture } from './routerFuture';
// All of Fraunces' axes, so the wordmark can use its soft, characterful style (SOFT and WONK).
import '@fontsource-variable/fraunces/full.css';
import './styles.css';

const client = new ApolloClient({
  uri: import.meta.env.VITE_GRAPHQL_URL ?? '/graphql',
  cache: new InMemoryCache(),
});

applyStoredPalette();
registerOffline();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <BrowserRouter future={routerFuture}>
        <App />
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>,
);
