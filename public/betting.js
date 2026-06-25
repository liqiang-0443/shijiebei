(function bettingModule(root) {
  function groupSelections(selections) {
    const groups = new Map();
    (selections || []).forEach((item) => {
      if (!groups.has(item.matchKey)) groups.set(item.matchKey, []);
      groups.get(item.matchKey).push(item);
    });
    return [...groups.values()];
  }

  function combinations(items, size) {
    const out = [];
    const walk = (start, picked) => {
      if (picked.length === size) {
        out.push([...picked]);
        return;
      }
      for (let index = start; index <= items.length - (size - picked.length); index += 1) {
        picked.push(items[index]);
        walk(index + 1, picked);
        picked.pop();
      }
    };
    walk(0, []);
    return out;
  }

  function buildTickets(selections, passModes) {
    const modes = [...(passModes || [])].sort((a, b) => a - b);
    const grouped = groupSelections(selections);
    const tickets = [];

    if (modes.includes(1)) {
      (selections || []).filter((item) => item.single).forEach((item) => {
        tickets.push({ mode: 1, odds: Number(item.sp) || 0, picks: [item] });
      });
    }

    modes.filter((mode) => mode > 1).forEach((mode) => {
      combinations(grouped, mode).forEach((groupSet) => {
        const walk = (index, odds, picks) => {
          if (index === groupSet.length) {
            tickets.push({ mode, odds, picks });
            return;
          }
          groupSet[index].forEach((item) => walk(index + 1, odds * (Number(item.sp) || 0), [...picks, item]));
        };
        walk(0, 1, []);
      });
    });

    return tickets;
  }

  function pickKey(pick) {
    return pick.key || `${pick.matchKey}::${pick.pool || ""}::${pick.value || pick.label || ""}`;
  }

  function assignmentKeys(groups, limit = 20000) {
    let assignments = [new Set()];
    for (const group of groups) {
      const next = [];
      for (const base of assignments) {
        for (const pick of group) {
          const copy = new Set(base);
          copy.add(pickKey(pick));
          next.push(copy);
          if (next.length > limit) return next;
        }
      }
      assignments = next;
    }
    return assignments;
  }

  function maxCompatibleTicketOdds(tickets, selections) {
    if (!tickets.length) return 0;
    const groups = groupSelections(selections);
    if (!groups.length) return 0;
    let max = 0;
    for (const assignment of assignmentKeys(groups)) {
      const sum = tickets.reduce((total, ticket) => (
        ticket.picks.every((pick) => assignment.has(pickKey(pick))) ? total + ticket.odds : total
      ), 0);
      if (sum > max) max = sum;
    }
    return max;
  }

  function estimateBonusRange(selections, passModes, multiplier) {
    const ticketMultiplier = Number(multiplier) || 0;
    const tickets = buildTickets(selections, passModes);
    const ticketBonuses = tickets.map((ticket) => ticket.odds * 2 * ticketMultiplier);
    const minBonus = ticketBonuses.length ? Math.min(...ticketBonuses) : 0;
    const maxBonus = maxCompatibleTicketOdds(tickets, selections) * 2 * ticketMultiplier;
    return { tickets, minBonus, maxBonus };
  }

  const api = { buildTickets, estimateBonusRange, groupSelections, combinations };
  if (typeof module !== "undefined") module.exports = api;
  root.WorldCupBetting = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
