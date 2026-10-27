import { useQuery } from '@tanstack/react-query';
import { fetchApprovals } from './client';

/** The ranked approvals queue, shared by the table and the panel through the query cache. */
export function useApprovals() {
  return useQuery({
    queryKey: ['approvals'],
    queryFn: ({ signal }) => fetchApprovals(signal),
  });
}
