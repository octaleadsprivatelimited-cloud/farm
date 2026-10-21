import { api } from "./api.js";

export function bannerEditor(state, { esc, asset, assetOptions }) {
  const draft = state.heroDraft || state.adminHero;
  if (!draft) return '<div class="panel">Banner settings are loading.</div>';
  return `<div class="panel banner-editor"><div class="panel-heading"><div><h2>Homepage banners</h2><p>Choose the images customers see first. Mobile banners display without hero text.</p></div><a class="btn btn-outline btn-small" href="#home">View storefront</a></div><form data-form="hero-editor"><input type="hidden" name="revision" value="${draft.revision}"><div class="form-grid banner-settings"><label class="field"><span>Automatically rotate banners</span><input type="checkbox" name="autoplay" ${draft.autoplay ? "checked" : ""}></label><label class="field"><span>Seconds per banner</span><input type="number" name="intervalSeconds" min="4" max="20" value="${draft.intervalSeconds}" required></label></div><p class="field-note">Up to eight banners. Use a landscape photo for desktop and an optional 4:3 mobile crop. Upload JPEG, PNG or WebP up to 8 MB.</p><div class="banner-editor-list">${draft.slides
    .map(
      (s, i) =>
        `<fieldset class="banner-editor-row" data-banner-row><legend>Banner ${i + 1}</legend><input type="hidden" name="id" value="${esc(s.id)}"><div class="banner-editor-preview"><img src="${asset(s.image)}" alt="${esc(s.alt)}"><small>${s.active ? "Visible on homepage" : "Hidden from homepage"}</small></div><div class="form-grid"><label class="field"><span>Desktop image ${i + 1}</span><select name="image">${assetOptions(s.image)}</select></label><label class="field"><span>Mobile image ${i + 1}</span><select name="mobileImage"><option value="" ${!s.mobileImage ? "selected" : ""}>Use desktop image</option>${assetOptions(s.mobileImage)}</select></label><label class="field"><span>Upload desktop image ${i + 1}</span><input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp">${s.imageFile ? `<small>Selected: ${esc(s.imageFile.name)}</small>` : ""}</label><label class="field"><span>Upload mobile image ${i + 1}</span><input type="file" name="mobileImageFile" accept="image/jpeg,image/png,image/webp">${s.mobileImageFile ? `<small>Selected: ${esc(s.mobileImageFile.name)}</small>` : ""}</label><label class="field full"><span>Image description ${i + 1}</span><input name="alt" maxlength="200" value="${esc(s.alt)}" placeholder="Describe the image for screen readers" required></label><label class="field"><span>Open when tapped ${i + 1}</span><select name="link">${[
          ["#services", "Garden services"],
          ["#shop", "Plant shop"],
          ["#partner", "Become a partner"],
          ["#home", "Homepage"],
        ]
          .map(
            ([value, title]) =>
              `<option value="${value}" ${s.link === value ? "selected" : ""}>${title}</option>`,
          )
          .join(
            "",
          )}</select></label><label class="field"><span>Show banner ${i + 1}</span><input type="checkbox" name="active" ${s.active ? "checked" : ""}></label></div><div class="banner-row-actions"><button type="button" class="btn btn-outline btn-small" data-action="hero-up" data-id="${i}" ${i === 0 ? "disabled" : ""}>Move banner ${i + 1} up</button><button type="button" class="btn btn-outline btn-small" data-action="hero-down" data-id="${i}" ${i === draft.slides.length - 1 ? "disabled" : ""}>Move banner ${i + 1} down</button><button type="button" class="text-link" data-action="hero-remove" data-id="${i}" ${draft.slides.length === 1 ? "disabled" : ""}>Remove banner ${i + 1}</button></div></fieldset>`,
    )
    .join(
      "",
    )}</div><div class="modal-footer"><button type="button" class="btn btn-outline" data-action="hero-add" ${draft.slides.length >= 8 ? "disabled" : ""}>Add banner</button><button type="submit" class="btn btn-primary">Save homepage banners</button></div><p class="field-note">Keep at least one banner visible. Changes go live together after you save.</p></form></div>`;
}
function readDraft(state, form) {
  const old = state.heroDraft || state.adminHero;
  return {
    revision: Number(form.elements.revision.value),
    autoplay: form.elements.autoplay.checked,
    intervalSeconds: Number(form.elements.intervalSeconds.value),
    slides: [...form.querySelectorAll("[data-banner-row]")].map((row) => {
      const value = (name) => row.querySelector(`[name="${name}"]`);
      const previous = old.slides.find((s) => s.id === value("id").value);
      return {
        id: value("id").value,
        image: value("image").value,
        mobileImage: value("mobileImage").value,
        alt: value("alt").value,
        link: value("link").value,
        active: value("active").checked,
        imageFile: value("imageFile").files[0] || previous?.imageFile,
        mobileImageFile:
          value("mobileImageFile").files[0] || previous?.mobileImageFile,
      };
    }),
  };
}
export function changeBannerDraft(state, action, index) {
  const form = document.querySelector('[data-form="hero-editor"]');
  const draft = readDraft(state, form),
    i = Number(index);
  if (action === "hero-add" && draft.slides.length < 8)
    draft.slides.push({
      id: crypto.randomUUID(),
      image: "garden-hero.png",
      mobileImage: "",
      alt: "",
      link: "#services",
      active: true,
    });
  if (action === "hero-remove" && draft.slides.length > 1)
    draft.slides.splice(i, 1);
  if (action === "hero-up" && i > 0)
    [draft.slides[i - 1], draft.slides[i]] = [
      draft.slides[i],
      draft.slides[i - 1],
    ];
  if (action === "hero-down" && i < draft.slides.length - 1)
    [draft.slides[i + 1], draft.slides[i]] = [
      draft.slides[i],
      draft.slides[i + 1],
    ];
  state.heroDraft = draft;
}
export async function saveBannerDraft(state, form) {
  const draft = (state.heroDraft = readDraft(state, form));
  if (!draft.slides.some((s) => s.active))
    throw Error("Keep at least one banner visible");
  for (const s of draft.slides) {
    for (const key of ["image", "mobileImage"]) {
      if (s[key + "File"]) {
        const [id] = await api.upload([s[key + "File"]], "catalog");
        s[key] = `/api/uploads/${id}/content`;
        s[key + "File"] = undefined;
      }
    }
  }
  await api.put("/admin/hero", {
    ...draft,
    slides: draft.slides.map(({ imageFile, mobileImageFile, ...s }) => s),
  });
  state.heroDraft = null;
}
