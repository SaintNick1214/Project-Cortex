"use strict";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { ConvexProvider } from "./client.js";
const ConvexAuthContext = createContext(void 0);
export function useConvexAuth() {
  const authContext = useContext(ConvexAuthContext);
  if (authContext === void 0) {
    throw new Error(
      "Could not find `ConvexProviderWithAuth` (or `ConvexProviderWithClerk` or `ConvexProviderWithAuth0`) as an ancestor component. This component may be missing, or you might have two instances of the `convex/react` module loaded in your project."
    );
  }
  return authContext;
}
export function ConvexProviderWithAuth({
  children,
  client,
  useAuth
}) {
  const {
    isLoading: authProviderLoading,
    isAuthenticated: authProviderAuthenticated,
    fetchAccessToken
  } = useAuth();
  const [isConvexAuthenticated, setIsConvexAuthenticated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  if (authProviderLoading && isConvexAuthenticated !== null) {
    setIsConvexAuthenticated(null);
    setIsRefreshing(false);
  }
  if (!authProviderLoading && !authProviderAuthenticated && isConvexAuthenticated !== false) {
    setIsConvexAuthenticated(false);
    setIsRefreshing(false);
  }
  const isAuthenticated = authProviderAuthenticated && (isConvexAuthenticated ?? false);
  const isLoading = isConvexAuthenticated === null;
  const isRefreshingWhileAuthenticated = isRefreshing && isAuthenticated;
  const authState = useMemo(
    () => ({
      isLoading,
      isAuthenticated,
      isRefreshing: isRefreshingWhileAuthenticated
    }),
    [isLoading, isAuthenticated, isRefreshingWhileAuthenticated]
  );
  return /* @__PURE__ */ React.createElement(ConvexAuthContext.Provider, { value: authState }, /* @__PURE__ */ React.createElement(
    ConvexAuthStateFirstEffect,
    {
      authProviderAuthenticated,
      fetchAccessToken,
      authProviderLoading,
      client,
      setIsConvexAuthenticated,
      setIsRefreshing
    }
  ), /* @__PURE__ */ React.createElement(ConvexProvider, { client }, children), /* @__PURE__ */ React.createElement(
    ConvexAuthStateLastEffect,
    {
      authProviderAuthenticated,
      fetchAccessToken,
      authProviderLoading,
      client,
      setIsConvexAuthenticated,
      setIsRefreshing
    }
  ));
}
function ConvexAuthStateFirstEffect({
  authProviderAuthenticated,
  fetchAccessToken,
  authProviderLoading,
  client,
  setIsConvexAuthenticated,
  setIsRefreshing
}) {
  useEffect(() => {
    let isThisEffectRelevant = true;
    if (authProviderAuthenticated) {
      client.setAuth(
        fetchAccessToken,
        (backendReportsIsAuthenticated) => {
          if (isThisEffectRelevant) {
            setIsConvexAuthenticated(() => backendReportsIsAuthenticated);
          }
        },
        (isRefreshing) => {
          if (isThisEffectRelevant) {
            setIsRefreshing(isRefreshing);
          }
        }
      );
      return () => {
        isThisEffectRelevant = false;
        setIsConvexAuthenticated(
          (isConvexAuthenticated) => isConvexAuthenticated ? false : null
        );
        setIsRefreshing(false);
      };
    }
  }, [
    authProviderAuthenticated,
    fetchAccessToken,
    authProviderLoading,
    client,
    setIsConvexAuthenticated,
    setIsRefreshing
  ]);
  return null;
}
function ConvexAuthStateLastEffect({
  authProviderAuthenticated,
  fetchAccessToken,
  authProviderLoading,
  client,
  setIsConvexAuthenticated,
  setIsRefreshing
}) {
  useEffect(() => {
    if (authProviderAuthenticated) {
      return () => {
        client.clearAuth();
        setIsConvexAuthenticated(() => null);
        setIsRefreshing(false);
      };
    }
  }, [
    authProviderAuthenticated,
    fetchAccessToken,
    authProviderLoading,
    client,
    setIsConvexAuthenticated,
    setIsRefreshing
  ]);
  return null;
}
//# sourceMappingURL=ConvexAuthState.js.map
