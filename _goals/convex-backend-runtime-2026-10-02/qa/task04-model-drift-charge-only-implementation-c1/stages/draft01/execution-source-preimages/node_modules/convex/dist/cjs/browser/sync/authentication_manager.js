"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var authentication_manager_exports = {};
__export(authentication_manager_exports, {
  AuthenticationManager: () => AuthenticationManager
});
module.exports = __toCommonJS(authentication_manager_exports);
var import_jwt_decode = require("../../vendor/jwt-decode/index.js");
const MAXIMUM_REFRESH_DELAY = 20 * 24 * 60 * 60 * 1e3;
const MAX_TOKEN_CONFIRMATION_ATTEMPTS = 2;
class AuthenticationManager {
  constructor(syncState, callbacks, config) {
    __publicField(this, "authState", { state: "noAuth" });
    // Used to detect races involving `setConfig` calls
    // while a token is being fetched.
    __publicField(this, "configVersion", 0);
    // Shared by the BaseClient so that the auth manager can easily inspect it
    __publicField(this, "syncState");
    // Passed down by BaseClient, sends a message to the server
    __publicField(this, "authenticate");
    __publicField(this, "stopSocket");
    __publicField(this, "tryRestartSocket");
    __publicField(this, "pauseSocket");
    __publicField(this, "resumeSocket");
    // Passed down by BaseClient, sends a message to the server
    __publicField(this, "clearAuth");
    __publicField(this, "logger");
    __publicField(this, "refreshTokenLeewaySeconds");
    __publicField(this, "initialAuthTokenReuse");
    // Track last value to avoid redundant calls
    __publicField(this, "lastRefreshChange");
    // Number of times we have attempted to confirm the latest token. We retry up
    // to `MAX_TOKEN_CONFIRMATION_ATTEMPTS` times.
    __publicField(this, "tokenConfirmationAttempts", 0);
    this.syncState = syncState;
    this.authenticate = callbacks.authenticate;
    this.stopSocket = callbacks.stopSocket;
    this.tryRestartSocket = callbacks.tryRestartSocket;
    this.pauseSocket = callbacks.pauseSocket;
    this.resumeSocket = callbacks.resumeSocket;
    this.clearAuth = callbacks.clearAuth;
    this.logger = config.logger;
    this.refreshTokenLeewaySeconds = config.refreshTokenLeewaySeconds;
    this.initialAuthTokenReuse = config.initialAuthTokenReuse;
    this.lastRefreshChange = false;
  }
  notifyRefreshChange(isRefreshing) {
    if (this.authState.state !== "noAuth" && this.authState.state !== "initialRefetch" && this.authState.config.onRefreshChange && this.lastRefreshChange !== isRefreshing) {
      this.lastRefreshChange = isRefreshing;
      this.authState.config.onRefreshChange(isRefreshing);
    }
  }
  async setConfig(fetchToken, onChange, onRefreshChange) {
    this.resetAuthState();
    this._logVerbose("pausing WS for auth token fetch");
    this.pauseSocket();
    const token = await this.fetchTokenAndGuardAgainstRace(fetchToken, {
      forceRefreshToken: false
    });
    if (token.isFromOutdatedConfig) {
      return;
    }
    const config = {
      fetchToken,
      onAuthChange: onChange,
      onRefreshChange
    };
    if (token.value) {
      this.setAuthState({
        state: "waitingForServerConfirmationOfCachedToken",
        config,
        hasRetried: false
      });
      this.authenticate(token.value);
    } else {
      this.setAuthState({
        state: "initialRefetch",
        config
      });
      await this.refetchToken();
    }
    this._logVerbose("resuming WS after auth token fetch");
    this.resumeSocket();
  }
  onTransition(serverMessage) {
    if (!this.syncState.isCurrentOrNewerAuthVersion(
      serverMessage.endVersion.identity
    )) {
      return;
    }
    if (serverMessage.endVersion.identity <= serverMessage.startVersion.identity) {
      return;
    }
    this._logVerbose(
      `auth state is ${this.authState.state} when handling transition`
    );
    this.syncState.markAuthCompletion();
    if (this.authState.state === "waitingForServerConfirmationOfCachedToken") {
      this._logVerbose("server confirmed auth token is valid");
      const cachedToken = this.syncState.getAuth()?.value;
      if (this.initialAuthTokenReuse && cachedToken) {
        this.scheduleTokenRefetch(cachedToken, serverMessage.clientClockSkew);
      } else {
        void this.refetchToken();
      }
      this.authState.config.onAuthChange(true);
      return;
    }
    if (this.authState.state === "waitingForServerConfirmationOfFreshToken") {
      this._logVerbose("server confirmed new auth token is valid");
      this.notifyRefreshChange(false);
      this.scheduleTokenRefetch(this.authState.token);
      this.tokenConfirmationAttempts = 0;
      if (!this.authState.hadAuth) {
        this.authState.config.onAuthChange(true);
      }
    }
  }
  onAuthError(serverMessage) {
    if (serverMessage.authUpdateAttempted === false && (this.authState.state === "waitingForServerConfirmationOfFreshToken" || this.authState.state === "waitingForServerConfirmationOfCachedToken")) {
      this._logVerbose("ignoring non-auth token expired error");
      return;
    }
    const { baseVersion } = serverMessage;
    if (!this.syncState.isCurrentOrNewerAuthVersion(baseVersion + 1)) {
      this._logVerbose("ignoring auth error for previous auth attempt");
      return;
    }
    void this.tryToReauthenticate(serverMessage);
    return;
  }
  // This is similar to `refetchToken` defined below, in fact we
  // don't represent them as different states, but it is different
  // in that we pause the WebSocket so that mutations
  // don't retry with bad auth.
  async tryToReauthenticate(serverMessage) {
    this._logVerbose(`attempting to reauthenticate: ${serverMessage.error}`);
    if (
      // No way to fetch another token, kaboom
      this.authState.state === "noAuth" || // We failed on a fresh token. After a small number of retries, we give up
      // and clear the auth state to avoid infinite retries.
      this.authState.state === "waitingForServerConfirmationOfFreshToken" && this.tokenConfirmationAttempts >= MAX_TOKEN_CONFIRMATION_ATTEMPTS
    ) {
      this.logger.error(
        `Failed to authenticate: "${serverMessage.error}", check your server auth config`
      );
      if (this.syncState.hasAuth()) {
        this.syncState.clearAuth();
      }
      if (this.authState.state !== "noAuth") {
        this.setAndReportAuthFailed(this.authState.config.onAuthChange);
      }
      return;
    }
    if (this.authState.state === "waitingForServerConfirmationOfFreshToken") {
      this.tokenConfirmationAttempts++;
      this._logVerbose(
        `retrying reauthentication, ${MAX_TOKEN_CONFIRMATION_ATTEMPTS - this.tokenConfirmationAttempts} attempts remaining`
      );
    }
    this.notifyRefreshChange(true);
    await this.stopSocket();
    if (this.authState.state === "noAuth") {
      return;
    }
    const token = await this.fetchTokenAndGuardAgainstRace(
      this.authState.config.fetchToken,
      {
        forceRefreshToken: true
      }
    );
    if (token.isFromOutdatedConfig) {
      return;
    }
    if (token.value && this.syncState.isNewAuth(token.value)) {
      this.authenticate(token.value);
      this.setAuthState({
        state: "waitingForServerConfirmationOfFreshToken",
        config: this.authState.config,
        token: token.value,
        hadAuth: this.authState.state === "notRefetching" || this.authState.state === "waitingForScheduledRefetch"
      });
    } else {
      this._logVerbose("reauthentication failed, could not fetch a new token");
      if (this.syncState.hasAuth()) {
        this.syncState.clearAuth();
      }
      this.setAndReportAuthFailed(this.authState.config.onAuthChange);
    }
    this.tryRestartSocket();
  }
  // Force refetch the token and schedule another refetch
  // before the token expires - an active client should never
  // need to reauthenticate.
  async refetchToken() {
    if (this.authState.state === "noAuth") {
      return;
    }
    this._logVerbose("refetching auth token");
    const token = await this.fetchTokenAndGuardAgainstRace(
      this.authState.config.fetchToken,
      {
        forceRefreshToken: true
      }
    );
    if (token.isFromOutdatedConfig) {
      return;
    }
    if (token.value) {
      if (this.syncState.isNewAuth(token.value)) {
        this.setAuthState({
          state: "waitingForServerConfirmationOfFreshToken",
          hadAuth: this.syncState.hasAuth(),
          token: token.value,
          config: this.authState.config
        });
        this.authenticate(token.value);
      } else {
        this.setAuthState({
          state: "notRefetching",
          config: this.authState.config
        });
      }
    } else {
      this._logVerbose("refetching token failed");
      if (this.syncState.hasAuth()) {
        this.clearAuth();
      }
      this.setAndReportAuthFailed(this.authState.config.onAuthChange);
    }
    this._logVerbose(
      "restarting WS after auth token fetch (if currently stopped)"
    );
    this.tryRestartSocket();
  }
  scheduleTokenRefetch(token, clientClockSkewMs) {
    if (this.authState.state === "noAuth") {
      return;
    }
    const decodedToken = this.decodeToken(token);
    if (!decodedToken) {
      this.logger.error(
        "Auth token is not a valid JWT, cannot refetch the token"
      );
      return;
    }
    const { iat, exp } = decodedToken;
    if (!iat || !exp) {
      this.logger.error(
        "Auth token does not have required fields, cannot refetch the token"
      );
      return;
    }
    const fullLifetimeSeconds = exp - iat;
    if (fullLifetimeSeconds <= 2) {
      this.logger.error(
        "Auth token does not live long enough, cannot refetch the token"
      );
      return;
    }
    let tokenValiditySeconds;
    if (clientClockSkewMs !== void 0) {
      const estimatedServerNowSeconds = (Date.now() - clientClockSkewMs) / 1e3;
      tokenValiditySeconds = exp - estimatedServerNowSeconds;
      if (tokenValiditySeconds <= 0) {
        tokenValiditySeconds = 0;
      }
    } else {
      tokenValiditySeconds = fullLifetimeSeconds;
    }
    let delay = Math.min(
      MAXIMUM_REFRESH_DELAY,
      (tokenValiditySeconds - this.refreshTokenLeewaySeconds) * 1e3
    );
    if (delay <= 0) {
      this.logger.warn(
        `Refetching auth token immediately, configured leeway ${this.refreshTokenLeewaySeconds}s is larger than the token's lifetime ${tokenValiditySeconds}s`
      );
      delay = 0;
    }
    const refetchTokenTimeoutId = setTimeout(() => {
      this._logVerbose("running scheduled token refetch");
      void this.refetchToken();
    }, delay);
    this.setAuthState({
      state: "waitingForScheduledRefetch",
      refetchTokenTimeoutId,
      config: this.authState.config
    });
    this._logVerbose(
      `scheduled preemptive auth token refetching in ${delay}ms`
    );
  }
  // Protects against simultaneous calls to `setConfig`
  // while we're fetching a token
  async fetchTokenAndGuardAgainstRace(fetchToken, fetchArgs) {
    const originalConfigVersion = ++this.configVersion;
    this._logVerbose(
      `fetching token with config version ${originalConfigVersion}`
    );
    const token = await fetchToken(fetchArgs);
    if (this.configVersion !== originalConfigVersion) {
      this._logVerbose(
        `stale config version, expected ${originalConfigVersion}, got ${this.configVersion}`
      );
      return { isFromOutdatedConfig: true };
    }
    return { isFromOutdatedConfig: false, value: token };
  }
  stop() {
    this.resetAuthState();
    this.configVersion++;
    this._logVerbose(`config version bumped to ${this.configVersion}`);
  }
  setAndReportAuthFailed(onAuthChange) {
    onAuthChange(false);
    this.resetAuthState();
  }
  // The sole path to `state === "noAuth"`; consumers rely on this firing
  // `notifyRefreshChange(false)` to pair any in-flight `(true)`. May run
  // when refresh state is already false.
  resetAuthState() {
    this.notifyRefreshChange(false);
    this.setAuthState({ state: "noAuth" });
  }
  setAuthState(newAuth) {
    const authStateForLog = newAuth.state === "waitingForServerConfirmationOfFreshToken" ? {
      hadAuth: newAuth.hadAuth,
      state: newAuth.state,
      token: `...${newAuth.token.slice(-7)}`
    } : { state: newAuth.state };
    this._logVerbose(
      `setting auth state to ${JSON.stringify(authStateForLog)}`
    );
    switch (newAuth.state) {
      case "waitingForScheduledRefetch":
      case "notRefetching":
      case "noAuth":
        this.tokenConfirmationAttempts = 0;
        break;
      case "waitingForServerConfirmationOfFreshToken":
      case "waitingForServerConfirmationOfCachedToken":
      case "initialRefetch":
        break;
      default: {
        newAuth;
      }
    }
    if (this.authState.state === "waitingForScheduledRefetch") {
      clearTimeout(this.authState.refetchTokenTimeoutId);
    }
    this.authState = newAuth;
  }
  decodeToken(token) {
    try {
      return (0, import_jwt_decode.jwtDecode)(token);
    } catch (e) {
      this._logVerbose(
        `Error decoding token: ${e instanceof Error ? e.message : "Unknown error"}`
      );
      return null;
    }
  }
  _logVerbose(message) {
    this.logger.logVerbose(`${message} [v${this.configVersion}]`);
  }
}
//# sourceMappingURL=authentication_manager.js.map
