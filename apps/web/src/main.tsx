import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { routerFuture } from './routerFuture';
import './styles.css';

const client = new ApolloClient({
  uri: import.meta.env.VITE_GRAPHQL_URL ?? '/graphql',
  cache: new InMemoryCache(),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <BrowserRouter future={routerFuture}>
        <App />
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>,
);
