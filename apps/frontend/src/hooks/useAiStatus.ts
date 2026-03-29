import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AiStatus {
  aiEnabled: boolean;
  provider: string | null;
}

export function useAiStatus() {
  return useQuery<AiStatus>({
    queryKey: ['ai-status'],
    queryFn: async () => {
      const { data } = await api.get('/ai/status');
      return data;
    },
    staleTime: 60_000,
  });
}
