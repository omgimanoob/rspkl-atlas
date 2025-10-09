import { atlasPool } from '../../db';
import { config } from '../config';

export class BIService {
    static async getCustomerProjectHours() {
        const f = config.filters;
        const notInProjects = f.excludedProjectIds.length ? `AND project_id NOT IN (${f.excludedProjectIds.join(',')})` : '';
        const notInCustomers = f.excludedCustomerIds.length ? `AND customer_id NOT IN (${f.excludedCustomerIds.join(',')})` : '';
        const notInUsers = f.excludedUserIds.length ? `AND staff_member_id NOT IN (${f.excludedUserIds.join(',')})` : '';

        const [rows] = await atlasPool.query(`
      SELECT
        customer_name,
        project_name,
        CAST(ROUND(SUM(duration)/3600, 2) AS DOUBLE) AS total_hours
      FROM timesheet_snapshots
      WHERE
        duration IS NOT NULL
        ${notInProjects}
        ${notInCustomers}
        ${notInUsers}
      GROUP BY customer_name, project_name
      ORDER BY customer_name, project_name
    `);
        return rows;
    }

    static shapeSunburst(data) {
        const grouped = {};

        for (const row of data) {
            const { customer_name, project_name, total_hours } = row;
            if (!grouped[customer_name]) grouped[customer_name] = [];
            grouped[customer_name].push({ name: project_name, value: total_hours });
        }

        // 🔥 Calculate total per customer
        let customers = Object.entries(grouped).map(([name, children]: [string, any[]]) => {
            const total = children.reduce((sum, p) => sum + p.value, 0);
            return { name, children, total };
        });

        // 🔥 Sort customers by total descending
        customers = customers.sort((a, b) => b.total - a.total);

        // 🔥 Remove .total so ECharts gets only name & children
        return customers.map(({ name, children }) => ({ name, children }));
    }

}
