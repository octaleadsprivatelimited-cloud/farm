let csrfToken = null;
export const api = {
  setSession(data) {
    csrfToken = data.csrfToken || null;
  },
  async request(path, { method = "GET", body, headers = {} } = {}) {
    const response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      signal: AbortSignal.timeout(20000),
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        data.error?.message || "The request could not be completed",
      );
      error.status = response.status;
      error.code = data.error?.code;
      throw error;
    }
    return data;
  },
  get(path) {
    return this.request(path);
  },
  post(path, body, headers) {
    return this.request(path, { method: "POST", body, headers });
  },
  put(path, body) {
    return this.request(path, { method: "PUT", body });
  },
  patch(path, body) {
    return this.request(path, { method: "PATCH", body });
  },
  delete(path) {
    return this.request(path, { method: "DELETE" });
  },
  async upload(files, kind) {
    if (files.length > 8) throw Error("Select up to eight files");
    const ids = [];
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024)
        throw Error("Each file must be 8 MB or smaller");
      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          ...(kind === "document" ? ["application/pdf"] : []),
        ].includes(file.type)
      )
        throw Error("Choose JPEG, PNG, WebP or an allowed PDF document");
      const init = await this.post("/uploads/presign", {
        name: file.name,
        kind,
        contentType: file.type,
        size: file.size,
      });
      const local = init.uploadUrl.startsWith("/");
      const response = await fetch(init.uploadUrl, {
        method: "PUT",
        credentials: local ? "same-origin" : "omit",
        headers: {
          ...init.headers,
          ...(local && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: file,
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw Error("The file could not be uploaded");
      await this.post(`/uploads/${init.id}/complete`);
      ids.push(init.id);
    }
    return ids;
  },
  async download(type) {
    const response = await fetch(
      `/api/admin/reports/${encodeURIComponent(type)}`,
      { credentials: "same-origin" },
    );
    if (!response.ok) throw Error("The report could not be downloaded");
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `kaushik-${type}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
