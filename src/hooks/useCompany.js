import { useState, useEffect, useCallback } from "react";
import { COMPANY_KEY, fetchCompaniesApi, fetchCompanyBySlugApi, createCompanyApi, updateCompanyApi } from "../services/api";

export function useCompany() {
  const [companies, setCompanies] = useState([
    { id: 1, name: "Default", slug: "default", is_active: true },
  ]);

  const [activeCompanyId, setActiveCompanyId] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(COMPANY_KEY);
      return stored ? parseInt(stored, 10) || 1 : 1;
    }
    return 1;
  });

  // Resolve slug from current URL path
  const getSlugFromUrl = () => {
    if (typeof window === "undefined") return null;
    const pathSegments = window.location.pathname.split("/").filter(Boolean);
    if (pathSegments.length > 0 && pathSegments[0] !== "monitor") {
      return pathSegments[0].toLowerCase();
    }
    return null;
  };

  const loadCompanies = useCallback(async () => {
    try {
      const fixedCompanySlug = import.meta.env?.VITE_REA_COMPANY_SLUG?.toLowerCase();
      const urlSlug = fixedCompanySlug || getSlugFromUrl();

      // GET /companies is superadmin-only, so a normal visitor never gets the list back.
      // The company named in the URL is therefore resolved through the public by-slug
      // endpoint; the full list (superadmin only) is merged in when it is available.
      const [slugResponse, listResponse] = await Promise.all([
        urlSlug ? fetchCompanyBySlugApi(urlSlug) : null,
        fixedCompanySlug ? null : fetchCompaniesApi(),
      ]);
      const data = Array.isArray(listResponse) ? [...listResponse] : [];
      if (slugResponse && !Array.isArray(slugResponse) && !data.some((c) => c.id === slugResponse.id)) {
        data.push(slugResponse);
      }
      if (data.length > 0) {
        setCompanies(data);

        // Check if URL specifies an organization slug
        let matched = false;
        if (urlSlug) {
          const matchedComp = data.find((c) => c.slug.toLowerCase() === urlSlug);
          if (matchedComp) {
            matched = true;
            setActiveCompanyId(matchedComp.id);
            if (typeof window !== "undefined") {
              localStorage.setItem(COMPANY_KEY, String(matchedComp.id));
            }
          }
        }
        
        if (!matched) {
          // Verify if activeCompanyId exists in fetched company list
          const currentExist = data.some((c) => c.id === activeCompanyId);
          if (!currentExist && data[0] && data[0].id) {
            setActiveCompanyId(data[0].id);
            if (typeof window !== "undefined") {
              localStorage.setItem(COMPANY_KEY, String(data[0].id));
            }
          }
        }
      }
    } catch {
      // Keep default fallback
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Sync active company if browser URL path changes (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const urlSlug = getSlugFromUrl();
      if (urlSlug && companies.length > 0) {
        const matchedComp = companies.find((c) => c.slug.toLowerCase() === urlSlug);
        if (matchedComp) {
          setActiveCompanyId(matchedComp.id);
          localStorage.setItem(COMPANY_KEY, String(matchedComp.id));
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [companies]);

  const handleCreateCompany = async (payload) => {
    const newComp = await createCompanyApi(payload);
    await loadCompanies();
    return newComp;
  };

  const handleUpdateCompany = async (id, payload) => {
    const updatedComp = await updateCompanyApi(id, payload);
    await loadCompanies();
    return updatedComp;
  };

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];

  return {
    companies,
    activeCompanyId,
    activeCompany,
    reloadCompanies: loadCompanies,
    loadCompanies,
    handleCreateCompany,
    handleUpdateCompany,
  };
}
