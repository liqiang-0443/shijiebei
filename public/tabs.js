function activeTabNames(tabNames, active) {
  if (!tabNames.includes(active)) throw new Error("unknown tab");
  return {
    active,
    inactive: tabNames.filter((name) => name !== active),
  };
}

function setActiveTab(root, tabName) {
  const tabNames = [...root.querySelectorAll("[data-tab]")].map((item) => item.dataset.tab);
  const state = activeTabNames(tabNames, tabName);
  root.querySelectorAll("[data-tab]").forEach((item) => {
    const active = item.dataset.tab === tabName;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", String(active));
  });
  root.querySelectorAll("[data-panel]").forEach((item) => {
    item.hidden = item.dataset.panel !== tabName;
  });
  root.dispatchEvent(new CustomEvent("worldcup:tabchange", { detail: state }));
  return state;
}

if (typeof module !== "undefined") module.exports = { activeTabNames };

if (typeof window !== "undefined") {
  window.setActiveTab = setActiveTab;
  window.addEventListener("DOMContentLoaded", () => {
    const root = document.querySelector(".workbench");
    if (!root) return;
    root.querySelector(".tab-bar")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tab]");
      if (button) setActiveTab(root, button.dataset.tab);
    });
  });
}
