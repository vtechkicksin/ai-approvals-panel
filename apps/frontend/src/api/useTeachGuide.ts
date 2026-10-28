import { useQuery } from '@tanstack/react-query';
import { fetchTeachGuide } from './client';

/** The fixed review guide (from the policy). It rarely changes, so it is cached for the session. */
export function useTeachGuide() {
  return useQuery({
    queryKey: ['teach-guide'],
    queryFn: ({ signal }) => fetchTeachGuide(signal),
    staleTime: Infinity,
  });
}
