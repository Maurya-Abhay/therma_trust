import React from 'react';
import { JobCalendarScreen } from '@/src/components/scheduling/JobCalendarScreen';

export default function FacilityManagerCalendarScreen() {
  return (
    <JobCalendarScreen
      scope="facility_manager"
      title="Facility calendar"
      subtitle="Scheduled maintenance across your facilities."
      jobRoute={(jobId) => `/app/facility-manager/jobs/${jobId}`}
    />
  );
}
