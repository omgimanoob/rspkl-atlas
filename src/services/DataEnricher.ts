export class DataEnricher {
  static enrichProjects(projectRows, overrides) {
    return projectRows.map(p => {
      const override = overrides.find(o => o.kimai_project_id === p.id);
      return {
        ...p,
        statusId: override?.status_id ?? null,
        moneyCollected: override?.money_collected || 0,
        isProspective: override?.is_prospective === 1 || false,
        createdByUserId: override?.created_by_user_id || null,
        createdAt: override?.created_at ?? null,
        updatedAt: override?.updated_at ?? null,
      };
    });
  }

  static enrichTimesheets(timesheetRows, overrides) {
    return timesheetRows.map(row => {
      const override = overrides.find(o => o.kimai_project_id === row.project_id);
      return {
        ...row,
        statusId: override?.status_id ?? null,
        moneyCollected: override?.money_collected || 0,
        isProspective: override?.is_prospective === 1 || false,
        createdByUserId: override?.created_by_user_id || null,
      };
    });
  }
}
