import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

const LOGOUT_ERROR =
  "Could not sign out safely. Your session is still active. Please try again.";

export function useLogoutAction() {
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const requestLogout = useCallback(() => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setLoggingOut(true);
    setLogoutError(null);

    void (async () => {
      try {
        await signOut();
      } catch {
        if (mountedRef.current) setLogoutError(LOGOUT_ERROR);
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setLoggingOut(false);
      }
    })();
  }, [signOut]);

  return { loggingOut, logoutError, requestLogout };
}
