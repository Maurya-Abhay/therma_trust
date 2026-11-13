import { JobCalendarScreen } from '@/src/components/scheduling/JobCalendarScreen';

export default function ContractorCalendarScreen() {
  return (
    <JobCalendarScreen
      scope="contractor"
      title="Team calendar"
      subtitle="See when jobs assigned to your company are scheduled."
    />
  );
}
