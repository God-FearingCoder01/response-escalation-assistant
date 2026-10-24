import { useState, useEffect, useCallback } from "react";
import {
  fetchGlobalVariables,
  resolveGlobalVariablesInText,
} from "../services/globalVariableService";

export function useGlobalVariables(companyId = 1, currentAgent = null) {
  const [globalVariables, setGlobalVariables] = useState([]);
  const [loadingVars, setLoadingVars] = useState(false);

  const reloadGlobalVariables = useCallback(async () => {
    if (!currentAgent?.agent_initials) {
      setGlobalVariables([]);
      return;
    }
    setLoadingVars(true);
    try {
      const data = await fetchGlobalVariables(companyId);
      setGlobalVariables(data || []);
    } catch (err) {
      console.error("Error loading global variables:", err);
    } finally {
      setLoadingVars(false);
    }
  }, [companyId, currentAgent?.agent_initials]);

  useEffect(() => {
    reloadGlobalVariables();
  }, [reloadGlobalVariables]);

  const resolveVariables = useCallback(
    (text) => {
      return resolveGlobalVariablesInText(text, globalVariables);
    },
    [globalVariables]
  );

  return {
    globalVariables,
    loadingVars,
    reloadGlobalVariables,
    resolveVariables,
  };
}
