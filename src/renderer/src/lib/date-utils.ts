/**
 * Formats a date string or object into 'dd/mm/yyyy' format.
 * @param date The date to format (string, Date, undefined, or null)
 * @returns The formatted date string or '-' if invalid/missing
 */
export function formatDate(date: Date | string | undefined | null): string {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Formats a date string or object into time format (e.g., '10:30 AM').
 * @param date The date to format
 * @returns The formatted time string or '-' if invalid/missing
 */
export function formatTime(date: Date | string | undefined | null): string {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Formats a date string or object into separate date and time strings.
 * @param date The date to format
 * @returns Object containing date and time strings
 */
export function formatDateTime(date: Date | string | undefined | null): { date: string; time: string } {
    return {
        date: formatDate(date),
        time: formatTime(date)
    };
}

/**
 * Formats a date string or object into a full date time string 'dd/mm/yyyy, hh:mm AM/PM'
 * @param date The date to format
 * @returns The formatted string
 */
export function formatFullDateTime(date: Date | string | undefined | null): string {
    if (!date) return '-';
    const { date: d, time: t } = formatDateTime(date);
    if (d === '-') return '-';
    return `${d}, ${t}`;
}
