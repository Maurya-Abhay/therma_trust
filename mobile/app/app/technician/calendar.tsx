import { JobCalendarScreen } from '@/src/components/scheduling/JobCalendarScreen';

export default function TechnicianCalendarScreen() {
  return (
    <JobCalendarScreen
      scope="technician"
      title="Job calendar"
      subtitle="See when your assigned jobs are scheduled."
      jobRoute={(jobId) => ({ pathname: '/app/technician/jobs/[id]', params: { id: String(jobId) } })}
    />
  );
}
