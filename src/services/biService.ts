import { atlasPool } from '../../db';

export class BIService {
    static async getCustomerProjectHours() {
        const [rows] = await atlasPool.query(`
      SELECT
        customer_name,
        project_name,
        CAST(ROUND(SUM(duration)/3600, 2) AS DOUBLE) AS total_hours
      FROM timesheet_snapshots
      WHERE
        duration IS NOT NULL
        AND project_id NOT IN(92, 93, 94, 95, 140, 141, 142, 145, 157)
        AND customer_id NOT IN(43, 84, 85, 86)
        AND staff_member_id NOT IN (155, 156, 157, 158, 168, 169, 170, 173)
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
