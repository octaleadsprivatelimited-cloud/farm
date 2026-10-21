import { api } from "./api.js";
export function installLiveController(ui) {
  const s = () => ui.state();
  const enc = encodeURIComponent;
  const loginRequired = () => {
    if (s().user) return false;
    ui.account();
    return true;
  };
  const refresh = async () => {
    await ui.refresh();
    ui.render();
  };
  async function paid(payment) {
    if (payment.mode === "test") {
      await api.post(`/payments/${payment.id}/test-capture`);
      return { test: true };
    }
    if (payment.mode !== "razorpay")
      throw Error("Online payments are not available yet");
    if (!window.Razorpay)
      throw Error("The payment window could not load. Please try again.");
    return new Promise((resolve, reject) => {
      const gateway = new window.Razorpay({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        order_id: payment.providerOrderId,
        name: "Kaushik Nursery",
        prefill: {
          name: s().user.name,
          contact: s().user.phone || "",
          email: s().user.email || "",
        },
        theme: { color: "#36734a" },
        handler: async (response) => {
          try {
            const result = await api.post("/payments/verify", {
              paymentId: payment.id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            resolve(result);
          } catch (e) {
            reject(e);
          }
        },
        modal: {
          ondismiss: () =>
            reject(
              Error(
                "Payment window closed. Your pending order remains available in My orders.",
              ),
            ),
        },
      });
      gateway.on("payment.failed", () =>
        reject(
          Error("Payment was not completed. You can retry from your order."),
        ),
      );
      gateway.open();
    });
  }
  const actions = new Set([
    "hero-add",
    "hero-remove",
    "hero-up",
    "hero-down",
    "change-password",
    "confirm-refund",
    "retry-job",
    "service-package-add",
    "service-package-remove",
    "eligible-more",
    "category-toggle",
    "auth-otp",
    "cancel-order",
    "submit-booking",
    "logout",
    "super-admin-lock",
    "partner-status",
    "accept-lead",
    "decline-lead",
    "unassign",
    "confirm-cancel",
    "payment",
    "address-delete",
    "address-set-default",
    "export",
    "auth-register",
    "auth-login",
    "forgot-password",
    "notifications",
    "notification-read",
    "pay-booking",
    "pay-order",
    "load-more",
    "user-status",
    "category-create",
    "service-category-create",
  ]);
  const cartActions = new Set([
    "add-cart",
    "cart-qty",
    "cart-remove",
    "cart-add-similar",
    "favorite",
  ]);
  document.addEventListener(
    "click",
    async (event) => {
      const el = event.target.closest("[data-action]");
      if (!el) return;
      const action = el.dataset.action,
        id = el.dataset.id;
      if (!actions.has(action) && !(s().user && cartActions.has(action)))
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (el.disabled) return;
      el.disabled = true;
      try {
        if (action === "auth-otp") {
          ui.authForm("otp");
          return;
        }
        if (action === "auth-register") {
          ui.authForm("register");
          return;
        }
        if (action === "auth-login") {
          ui.authForm("login");
          return;
        }
        if (action === "forgot-password") {
          ui.authForm("forgot");
          return;
        }
        if (loginRequired()) return;
        if (action.startsWith("hero-")) {
          ui.changeBannerDraft(action, id);
          return;
        }
        if (action === "change-password") {
          ui.passwordForm();
          return;
        }
        if (action === "payment") {
          ui.refundConfirmation(id);
          return;
        }
        if (
          action === "service-package-add" ||
          action === "service-package-remove"
        ) {
          ui.changeServicePackages(action, id);
          return;
        }
        if (action === "eligible-more") {
          await ui.showAssign(id, true);
          return;
        }
        if (action === "confirm-refund")
          await api.post(`/admin/payments/${enc(id)}/refund`);
        if (action === "retry-job")
          await api.post(`/admin/jobs/${enc(id)}/retry`);
        if (action === "category-toggle")
          await api.patch(
            `/admin/${el.dataset.kind === "service" ? "service-categories" : "categories"}/${enc(id)}`,
            { active: el.dataset.active === "true" },
          );
        if (cartActions.has(action)) {
          if (action === "favorite") {
            await api.put(`/wishlist/${enc(id)}`, {
              saved: !s().favorites.includes(id),
            });
            await ui.refreshAccount();
            ui.render();
            return;
          }
          const current = s().cart.find((c) => c.id === id)?.qty || 0;
          const quantity =
            action === "cart-remove"
              ? 0
              : action === "cart-qty"
                ? current + Number(el.dataset.change)
                : current + 1;
          await api.put(`/cart/${enc(id)}`, { quantity });
          await ui.refreshAccount();
          ui.render();
          if (["cart-qty", "cart-remove", "cart-add-similar"].includes(action))
            ui.showCart();
          else ui.toast("Added to your bag.");
          return;
        }
        if (action === "submit-booking") {
          const m = ui.modal(),
            service = s().services.find((x) => x.id === m.serviceId),
            p = service.packages[m.packageIndex];
          const f = m.form;
          const fingerprint = JSON.stringify([service.id, p.id, f]);
          if (m.requestFingerprint !== fingerprint) {
            m.requestKey = crypto.randomUUID();
            m.requestFingerprint = fingerprint;
          }
          const result = await api.post(
            "/bookings",
            {
              serviceId: service.id,
              packageId: p.id,
              name: f.name,
              phone: f.phone,
              city: f.city,
              address: f.address,
              property: f.property,
              area: Number(f.area),
              date: f.date,
              time: f.time,
              description: f.description,
              uploadIds: f.uploadIds || [],
            },
            { "Idempotency-Key": m.requestKey },
          );
          ui.setOrderTab("services");
          await refresh();
          ui.closeModal();
          location.hash = "orders";
          ui.toast(
            `Request received. ${result.recipients.length} eligible partners notified.`,
          );
          return;
        }
        if (action === "logout" || action === "super-admin-lock") {
          await api.post("/auth/logout");
          api.setSession({});
          ui.closeModal();
          await refresh();
          location.hash = "home";
          ui.toast("You have signed out.");
          return;
        }
        if (action === "partner-status")
          await api.patch(`/admin/partners/${enc(id)}/status`, {
            status: el.dataset.status,
          });
        if (action === "accept-lead" || action === "decline-lead")
          await api.post(
            `/partner/leads/${enc(id)}/${action === "accept-lead" ? "accept" : "decline"}`,
          );
        if (action === "unassign")
          await api.post(`/admin/bookings/${enc(id)}/assign`, {
            partnerId: null,
          });
        if (action === "cancel-order")
          await api.post(`/orders/${enc(id)}/cancel`);
        if (action === "confirm-cancel")
          await api.post(`/bookings/${enc(id)}/cancel`);
        if (action === "address-delete")
          await api.delete(`/addresses/${enc(id)}`);
        if (action === "address-set-default")
          await api.patch(`/addresses/${enc(id)}/default`);

        if (action === "user-status")
          await api.patch(`/admin/users/${enc(id)}/status`, {
            status: el.dataset.status,
          });
        if (action === "export") {
          await api.download(id);
          return;
        }
        if (action === "load-more") {
          await ui.loadMore(id);
          if (id === "notifications") ui.showNotifications();
          else ui.render();
          return;
        }
        if (action === "notifications") {
          ui.showNotifications();
          return;
        }
        if (action === "notification-read") {
          await api.patch(`/notifications/${enc(id)}/read`);
          await refresh();
          ui.showNotifications();
          return;
        }
        if (action === "pay-booking" || action === "pay-order") {
          const p = await api.post("/payments", {
            [action === "pay-booking" ? "bookingId" : "orderId"]: id,
          });
          const result = await paid(p);
          await refresh();
          ui.toast(
            result.test
              ? "Test payment recorded. No money collected."
              : result.pending
                ? "Payment confirmation is pending."
                : "Payment confirmed.",
          );
          return;
        }
        if (
          action === "category-create" ||
          action === "service-category-create"
        ) {
          ui.categoryForm(action === "category-create" ? "product" : "service");
          return;
        }
        await refresh();
        ui.closeModal();
        ui.toast(
          action === "confirm-refund"
            ? "Refund queued for reconciliation."
            : "Saved successfully.",
        );
      } catch (error) {
        ui.toast(error.message);
        if (error.status === 401) {
          await refresh();
          ui.account();
        }
      } finally {
        if (el.isConnected) el.disabled = false;
      }
    },
    true,
  );
  const forms = new Set([
    "hero-editor",
    "business-profile",
    "change-password",
    "admin-user-search",
    "eligible-search",
    "auth-login",
    "auth-register",
    "auth-forgot",
    "auth-reset",
    "auth-otp-request",
    "auth-otp-verify",
    "checkout",
    "booking-details",
    "partner-profile",
    "partner-register",
    "lead-settings",
    "notification",
    "assign",
    "job-update",
    "product-edit",
    "service-edit",
    "address-save",
    "customer-profile",
    "review",
    "newsletter",
    "category-create",
    "service-category-create",
  ]);
  document.addEventListener(
    "submit",
    async (event) => {
      const form = event.target,
        type = form.dataset.form;
      if (!forms.has(type)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!form.reportValidity()) return;
      const submit = form.querySelector(
        'button[type="submit"],button:not([type])',
      );
      if (submit?.disabled) return;
      if (submit) submit.disabled = true;
      const fd = new FormData(form),
        f = Object.fromEntries(fd);
      try {
        if (type === "hero-editor") await ui.saveBannerDraft(form);
        if (type === "auth-login" || type === "auth-register") {
          const guestCart = s().user ? [] : [...s().cart],
            guestFavorites = s().user ? [] : [...s().favorites];
          const session = await api.post(
            type === "auth-login" ? "/auth/login" : "/auth/register",
            type === "auth-login"
              ? { email: f.email, password: f.password }
              : {
                  name: f.name,
                  email: f.email,
                  password: f.password,
                  city: s().city,
                },
          );
          api.setSession(session);
          for (const line of guestCart)
            await api
              .put(`/cart/${enc(line.id)}`, { quantity: line.qty })
              .catch(() => {});
          for (const id of guestFavorites)
            await api
              .put(`/wishlist/${enc(id)}`, { saved: true })
              .catch(() => {});
          await refresh();
          ui.closeModal();
          location.hash =
            session.user.role === "admin"
              ? "super-admin"
              : session.user.role === "partner"
                ? "partner"
                : "customer-admin";
          ui.toast("Welcome to your green space.");
          return;
        }
        if (type === "auth-forgot") {
          await api.post("/auth/forgot-password", { email: f.email });
          ui.toast("If the account exists, a reset email has been sent.");
          return;
        }
        if (type === "auth-reset") {
          await api.post("/auth/reset-password", {
            token: f.token,
            password: f.password,
          });
          ui.authForm("login");
          ui.toast("Password updated. Sign in again.");
          return;
        }
        if (type === "auth-otp-request") {
          const response = await api.post("/auth/otp/request", {
            phone: f.phone,
          });
          ui.otpForm(response.challengeId);
          return;
        }
        if (type === "auth-otp-verify") {
          const session = await api.post("/auth/otp/verify", {
            challengeId: f.challengeId,
            code: f.code,
            name: f.name || "Garden lover",
          });
          api.setSession(session);
          await refresh();
          ui.closeModal();
          location.hash =
            session.user.role === "admin"
              ? "super-admin"
              : session.user.role === "partner"
                ? "partner"
                : "customer-admin";
          return;
        }
        if (type === "newsletter") {
          await api.post("/newsletter", { email: f.email });
          form.reset();
          ui.toast("Thank you for joining our growing community.");
          return;
        }
        if (loginRequired()) return;
        if (type === "business-profile") {
          await api.put("/admin/business", {
            name: f.name,
            email: f.email,
            phone: f.phone,
            address: f.address,
          });
          await refresh();
          ui.toast("Public business details saved.");
          return;
        }
        if (type === "change-password") {
          if (f.password !== f.confirmation)
            throw Error("The new passwords do not match");
          const session = await api.post("/auth/change-password", {
            currentPassword: f.currentPassword,
            password: f.password,
          });
          api.setSession(session);
          await refresh();
          ui.closeModal();
          ui.toast("Password updated. Other sessions have been signed out.");
          return;
        }
        if (type === "admin-user-search") {
          await ui.searchAdminUsers(f.query);
          return;
        }
        if (type === "eligible-search") {
          await ui.showAssign(ui.modal().id, false, f.query);
          return;
        }
        if (type === "booking-details") {
          const m = ui.modal();
          m.form = {
            ...m.form,
            ...f,
            uploadIds: await api.upload(
              [...form.elements.images.files],
              "reference",
            ),
            images: [...form.elements.images.files].map((x) => x.name),
          };
          m.step = 3;
          ui.showBooking();
          return;
        }
        if (type === "checkout") {
          if (s().paymentMode === "disabled")
            throw Error(
              "Online payments are not available yet. Please contact the nursery.",
            );
          const old = s().user.addresses?.find(
            (a) => a.id === f.selected_address_id,
          );
          let addressId = old?.id;
          if (
            !old ||
            old.name !== f.name ||
            old.phone !== f.phone ||
            old.line !== f.address ||
            old.city !== f.city ||
            old.pincode !== f.postal
          ) {
            const result = await api.post("/addresses", {
              tag: "Delivery",
              name: f.name,
              phone: f.phone,
              line: f.address,
              city: f.city,
              pincode: f.postal,
              isDefault: !s().user.addresses?.length,
            });
            addressId = result.id;
          }
          const items = s().cart.map((c) => ({ id: c.id, qty: c.qty }));
          if (!items.length) throw Error("Your bag is empty.");
          const fingerprint = JSON.stringify({
            user: s().user.id,
            addressId,
            items,
          });
          let pending;
          try {
            pending = JSON.parse(sessionStorage.getItem("kn-pending-checkout"));
          } catch {}
          if (!pending || pending.fingerprint !== fingerprint)
            pending = { fingerprint, key: crypto.randomUUID() };
          sessionStorage.setItem(
            "kn-pending-checkout",
            JSON.stringify(pending),
          );
          const estimate = items.reduce(
            (sum, line) =>
              sum +
              (s().products.find((p) => p.id === line.id)?.price || 0) *
                line.qty,
            0,
          );
          const expectedTotal = estimate + (estimate >= 1000 ? 0 : 99);
          const order = await api.post(
            "/orders",
            { addressId, items },
            { "Idempotency-Key": pending.key },
          );
          if (["Expired", "Cancelled"].includes(order.status)) {
            sessionStorage.removeItem("kn-pending-checkout");
            throw Error(
              "The previous reservation expired. Please submit checkout again.",
            );
          }
          if (order.total !== expectedTotal) {
            await refresh();
            ui.closeModal();
            location.hash = "orders";
            ui.setOrderTab("products");
            ui.render();
            ui.toast(
              "A price changed. Review the saved order total before completing payment.",
            );
            return;
          }
          const payment = await api.post("/payments", { orderId: order.id }),
            result = await paid(payment);
          sessionStorage.removeItem("kn-pending-checkout");
          ui.setOrderTab("products");
          await refresh();
          ui.closeModal();
          location.hash = "orders";
          ui.toast(
            result.test
              ? "Test order placed. No money was collected."
              : result.pending
                ? "Your payment is awaiting confirmation."
                : "Your order is confirmed.",
          );
          return;
        }
        if (type === "partner-profile")
          await api.patch("/partner/profile", {
            name: f.name,
            person: f.person,
            city: f.city,
            experience: f.experience,
            available: fd.has("available"),
          });
        if (type === "partner-register") {
          const categories = fd.getAll("categories");
          if (!categories.length)
            throw Error("Select at least one service category");
          const uploadIds = [
            ...fd.getAll("existingUploadIds"),
            ...(await api.upload(
              [...form.elements.documents.files],
              "document",
            )),
          ];
          if (!uploadIds.length)
            throw Error("Upload at least one identity or business document");
          if (uploadIds.length > 8)
            throw Error("Keep up to eight application documents");
          const body = {
            name: f.name,
            person: f.person,
            city: f.city,
            address: f.address,
            experience: f.experience,
            phone: f.phone,
            categories,
            uploadIds,
          };
          if (ui.modal().applicationUpdate)
            await api.put("/partner/application", body);
          else await api.post("/partners/apply", body);
        }
        if (type === "lead-settings")
          await api.put("/admin/settings", {
            maxPartners: Number(f.maxPartners),
            rotation: fd.has("rotation"),
          });
        if (type === "notification")
          await api.post("/admin/notifications", {
            audience:
              f.audience === "All customers"
                ? "customers"
                : f.audience === "All service partners"
                  ? "partners"
                  : "all",
            title: f.title,
            message: f.message,
          });
        if (type === "assign")
          await api.post(`/admin/bookings/${enc(ui.modal().id)}/assign`, {
            partnerId: f.partner,
          });
        if (type === "job-update")
          await api.patch(`/partner/jobs/${enc(ui.modal().id)}`, {
            status: f.status,
            remarks: f.remarks,
            uploadIds: await api.upload(
              [...form.elements.photos.files],
              "completion",
            ),
          });
        if (type === "product-edit" || type === "service-edit") {
          const old = (
            type === "product-edit" ? s().products : s().services
          ).find((p) => p.id === ui.modal().id);
          let image = f.image;
          const photo = form.elements.photo.files[0] || ui.modal().pendingPhoto;
          if (photo) {
            const [id] = await api.upload([photo], "catalog");
            image = `/api/uploads/${id}/content`;
          }
          const body =
            type === "product-edit"
              ? {
                  name: f.name,
                  category: f.category,
                  description: f.description,
                  price: Number(f.price),
                  oldPrice: Number(f.oldPrice) || 0,
                  stock: Number(f.stock),
                  image,
                  care: f.care,
                  water: f.water,
                  badge: old?.badge || "",
                  active: fd.has("active"),
                }
              : {
                  name: f.name,
                  category: f.category,
                  description: f.description,
                  image,
                  label: old?.label || "",
                  active: fd.has("active"),
                  packages: fd.getAll("packageName").map((name, i) => ({
                    ...(fd.getAll("packageId")[i]
                      ? { id: fd.getAll("packageId")[i] }
                      : {}),
                    name,
                    price: Number(fd.getAll("packagePrice")[i]),
                    description: fd.getAll("packageDescription")[i] || "",
                  })),
                };
          const path =
            type === "product-edit" ? "/admin/products" : "/admin/services";
          if (old) await api.put(`${path}/${enc(old.id)}`, body);
          else await api.post(path, body);
        }
        if (type === "address-save") {
          const body = {
            tag: f.tag,
            name: f.name,
            phone: f.phone,
            line: f.line,
            city: f.city,
            pincode: f.pincode,
            isDefault: fd.has("isDefault"),
          };
          if (f.id) await api.put(`/addresses/${enc(f.id)}`, body);
          else await api.post("/addresses", body);
        }
        if (type === "customer-profile")
          await api.patch("/account", {
            name: f.name,
            city: f.city,
            contactPhone: f.contactPhone,
          });
        if (type === "review")
          await api.put(`/bookings/${enc(ui.modal().id)}/review`, {
            rating: Number(f.rating),
            text: f.text,
          });
        if (type === "category-create")
          await api.post("/admin/categories", {
            name: f.name,
            slug: f.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, ""),
          });
        if (type === "service-category-create")
          await api.post("/admin/service-categories", { name: f.name });
        await refresh();
        ui.closeModal();
        ui.toast(
          type === "notification"
            ? "Broadcast queued for delivery."
            : "Saved successfully.",
        );
      } catch (error) {
        ui.toast(error.message);
        if (error.status === 401) {
          await refresh();
          ui.account();
        }
      } finally {
        if (submit?.isConnected) submit.disabled = false;
      }
    },
    true,
  );
  document.addEventListener(
    "change",
    async (event) => {
      if (!event.target.matches(".order-status-select")) return;
      event.stopImmediatePropagation();
      try {
        await api.patch(
          `/admin/orders/${enc(event.target.dataset.id)}/status`,
          { status: event.target.value },
        );
        await refresh();
        ui.toast("Order updated.");
      } catch (error) {
        ui.toast(error.message);
        await refresh();
      }
    },
    true,
  );
}
