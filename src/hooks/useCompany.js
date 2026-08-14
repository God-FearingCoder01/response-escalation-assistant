import { useState, useEffect, useCallback } from "react";
import { COMPANY_KEY, fetchCompaniesApi, createCompanyApi, updateCompanyApi } from "../services/api";

export function useCompany() {
  const [companies, setCompanies] = useState([
    { id: 1, name: "Corp A", slug: "corp-a", is_active: true },
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
      const data = await fetchCompaniesApi();
      if (Array.isArray(data) && data.length > 0) {
        setCompanies(data);

        // Check if URL specifies an organization slug
        const urlSlug = getSlugFromUrl();
        if (urlSlug) {
          const matchedComp = data.find((c) => c.slug.toLowerCase() === urlSlug);
          if (matchedComp) {
            setActiveCompanyId(matchedComp.id);
            if (typeof window !== "undefined") {
              localStorage.setItem(COMPANY_KEY, String(matchedComp.id));
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

  const switchCompany = (newIdOrSlug, screen = null) => {
    let target = null;
    if (typeof newIdOrSlug === "number") {
      target = companies.find((c) => c.id === newIdOrSlug);
    } else if (typeof newIdOrSlug === "string") {
      const parsedId = parseInt(newIdOrSlug, 10);
      if (!isNaN(parsedId)) {
        target = companies.find((c) => c.id === parsedId);
      }
      if (!target) {
        target = companies.find((c) => c.slug.toLowerCase() === newIdOrSlug.toLowerCase());
      }
    }

    if (!target) {
      target = companies[0];
    }

    if (target) {
      setActiveCompanyId(target.id);
      if (typeof window !== "undefined") {
        localStorage.setItem(COMPANY_KEY, String(target.id));

        // Push new URL slug to history
        const newPath = screen ? `/${target.slug}/${screen}` : `/${target.slug}`;
        if (window.location.pathname !== newPath && window.location.pathname !== "/monitor") {
          window.history.pushState({ companyId: target.id }, "", newPath);
        }
      }
    }
  };

  const handleCreateCompany = async (payload) => {
    const newComp = await createCompanyApi(payload);
    await loadCompanies();
    if (newComp && newComp.id) {
      switchCompany(newComp.id);
    }
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
    switchCompany,
    loadCompanies,
    handleCreateCompany,
    handleUpdateCompany,
  };
}
