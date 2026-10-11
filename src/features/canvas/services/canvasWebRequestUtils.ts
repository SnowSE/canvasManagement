import { axiosClient } from "@/services/axiosUtils";
import { AxiosResponse, AxiosRequestConfig } from "axios";

// Rate limits are handled for every Canvas request by the queue in
// src/services/canvasRequestQueue.ts (installed on the server's axiosClient,
// which the browser reaches through the /api/canvas proxy).

export const rateLimitAwarePost = <T>(
  url: string,
  body: unknown,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> => axiosClient.post<T>(url, body, config);

export const rateLimitAwareDelete = async (url: string): Promise<void> => {
  await axiosClient.delete(url);
};
