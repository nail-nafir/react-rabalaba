import { useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

/**
 * A dialog whose open item lives in the URL (`?key=value`), so the link can be
 * shared and the browser Back button closes it. Opening pushes a history entry
 * marked in `location.state`; closing pops that entry when this page pushed it,
 * otherwise (someone landed on a shared link) it only drops the param.
 */
export function useDialogParam(key: string) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  // `location` gets a new identity on every navigation: one close per entry, so
  // a double Escape before Back lands can't pop the page behind the dialog.
  const closedAt = useRef<object | null>(null);

  const open = (value: string) =>
    setParams(
      (current) => {
        current.set(key, value);
        return current;
      },
      { state: { dialog: key }, preventScrollReset: true },
    );

  const close = () => {
    if (!params.has(key) || closedAt.current === location) return;
    closedAt.current = location;
    if ((location.state as { dialog?: string } | null)?.dialog === key) {
      navigate(-1);
      return;
    }
    setParams(
      (current) => {
        current.delete(key);
        return current;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  return { value: params.get(key), open, close };
}
