export function isAdmin(user) {
  return user?.role === "admin";
}

export function isSales(user) {
  return user?.role === "sales" || isAdmin(user);
}

export function isDelivery(user) {
  return user?.role === "manager" || user?.role === "member" || isAdmin(user);
}

export function isManager(user) {
  return user?.role === "manager" || isAdmin(user);
}

export function navFor(user) {
  if (isAdmin(user)) {
    return [
      { href: "#/", label: "Admin" },
      { href: "#/forecast", label: "Forecast" },
      { href: "#/deals", label: "Deals" },
      { href: "#/accounts", label: "Accounts" },
      { href: "#/projects", label: "Projects" },
      { href: "#/log", label: "Log time" },
    ];
  }
  if (user?.role === "sales") {
    return [
      { href: "#/", label: "Forecast" },
      { href: "#/deals", label: "Deals" },
      { href: "#/accounts", label: "Accounts" },
    ];
  }
  return [
    { href: "#/", label: "Projects" },
    { href: "#/log", label: "Log time" },
  ];
}

export function isNavActive(hash, href, items) {
  const h = !hash || hash === "#" ? "#/" : hash;
  const match = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => {
      if (item.href === "#/") return h === "#/" || h === "";
      return h === item.href || h.startsWith(`${item.href}/`);
    });
  return match?.href === href;
}

export function canOpen(user, hash) {
  if (isAdmin(user)) return true;
  if (hash === "#/forecast" || hash === "#/admin" || hash === "#/projects") {
    return isAdmin(user);
  }
  if (hash.startsWith("#/projects/") || hash === "#/log") return isDelivery(user);
  if (hash === "#/accounts" || hash.startsWith("#/accounts/") || hash === "#/deals" || hash.startsWith("#/deals/")) {
    return user?.role === "sales";
  }
  return true;
}
