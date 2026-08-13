import { useState, useEffect } from "react";
import { COMPANY_KEY, fetchCompaniesApi } from "../services/api";

export function useCompany() {
  const [companies, setCompanies] = useState([
    { id: 1, name: "Default Organization", slug: "default", is_active: true }
  ]);
  const [activeCompanyId, setActiveCompanyId] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(COMPANY_KEY);
      return stored ? parseInt(stored, 10) || 1 : 1;
    }
    return 1;
  });

  const loadCompanies = async () => {
    try {
      const data = await fetchCompaniesApi();
      if (Array.isArray(data) && data.length > 0) {
        setCompanies(data);
      }
    } catch {
      // Keep default fallback
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const switchCompany = (newId) => {
    const numericId = parseInt(newId, 10) || 1;
    setActiveCompanyId(numericId);
    if (typeof window !== "undefined") {
      localStorage.setItem(COMPANY_KEY, String(numericId));
      window.location.reload();
    }
  };

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];

  return {
    companies,
    activeCompanyId,
    activeCompany,
    switchCompany,
    loadCompanies,
  };
}
