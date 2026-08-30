import { pageHeader } from '../../components/ui.js';
import { escapeHtml, formDataObject, setButtonLoading } from '../../utils/dom.js';
import { changePassword, updateOwnProfile } from '../../services/auth.service.js';
import { removeOwnProfilePhoto, uploadOwnProfilePhoto } from '../../services/profile-photo.service.js';
import { CAS_PROGRAMS } from '../../config/app.config.js';
import { store } from '../../core/store.js';
import { toast } from '../../components/toast.js';
import '../../styles/profile-v70.css';

function initialsFor(profile) {
  const name = profile?.displayName || profile?.email || 'CAS User';
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CU';
}

function safePhotoUrl(profile) {
  const value = String(profile?.profilePhotoUrl || '');
  return /^data:image\/(?:jpeg|png|webp);base64,/i.test(value) ? value : '';
}

function profilePhotoMarkup(profile, adminInstitutional = false) {
  const photo = safePhotoUrl(profile);
  if (photo) {
    return `<img class="profile-photo-image" src="${escapeHtml(photo)}" alt="${escapeHtml(profile.displayName || 'User')} profile photo">`;
  }
  if (adminInstitutional) {
    return `<img class="profile-photo-image institutional" src="/assets/cas-logo.jpg" alt="College of Arts and Sciences logo">`;
  }
  return `<div class="profile-photo-placeholder">${escapeHtml(initialsFor(profile))}</div>`;
}

function roleLabel(role) {
  if (role === 'admin') return 'System Administrator';
  if (role === 'adviser') return 'Thesis Adviser';
  return 'Student Researcher';
}

function programOptions(selected) {
  return CAS_PROGRAMS.map((program) => `<option value="${escapeHtml(program)}" ${program === selected ? 'selected' : ''}>${escapeHtml(program)}</option>`).join('');
}

export async function render({ profile }) {
  const canUploadPhoto = ['student', 'adviser', 'admin'].includes(profile.role);
  const idLabel = profile.role === 'student' ? 'Student ID' : 'Employee ID';
  const idName = profile.role === 'student' ? 'studentId' : 'employeeId';
  const idValue = profile.role === 'student' ? profile.studentId : profile.employeeId;

  const studentFields = profile.role === 'student' ? `
    <div class="form-grid two">
      <label class="field">
        <span>Program</span>
        <select name="program" required>
          ${programOptions(profile.program || '')}
        </select>
      </label>
      <label class="field">
        <span>Department / College</span>
        <input value="College of Arts and Sciences" disabled>
      </label>
    </div>
    <div class="form-grid two">
      <label class="field">
        <span>Registered research title</span>
        <input value="${escapeHtml(profile.researchTitle || 'Not recorded for this legacy account')}" disabled>
      </label>
      <label class="field">
        <span>Research year</span>
        <input value="${escapeHtml(profile.researchYear || 'Not recorded')}" disabled>
      </label>
    </div>
    <small>The registered research title and year cannot be changed from the profile because this pair is used to prevent duplicate accounts.</small>` : '';

  const adviserDepartment = profile.role === 'adviser' ? `
    <div class="form-grid two">
      <label class="field">
        <span>Department / College</span>
        <input value="College of Arts and Sciences" disabled>
      </label>
      <label class="field">
        <span>Account status</span>
        <input value="${escapeHtml(profile.status || 'active')}" disabled>
      </label>
    </div>` : '';

  const adminDepartment = profile.role === 'admin' ? `
    <div class="form-grid two">
      <label class="field">
        <span>Department / College</span>
        <input name="department" value="${escapeHtml(profile.department || 'College of Arts and Sciences')}">
      </label>
      <label class="field">
        <span>Account status</span>
        <input value="${escapeHtml(profile.status || 'active')}" disabled>
      </label>
    </div>` : '';

  return `${pageHeader('My Profile', 'Manage your account information, profile photo, and password security.')}
    <div class="profile-page-grid">
      <section class="panel profile-photo-panel">
        <div class="panel-body">
          <div class="profile-photo-stage" id="profile-photo-stage">
            ${profilePhotoMarkup(profile, profile.role === 'admin')}
          </div>
          <div class="profile-photo-copy">
            <p class="eyebrow">${escapeHtml(roleLabel(profile.role))}</p>
            <h2>${escapeHtml(profile.displayName || 'CAS User')}</h2>
            <p>${escapeHtml(profile.email || '')}</p>
          </div>
          ${canUploadPhoto ? `
            <div class="profile-photo-actions">
              <input id="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>
              <button class="btn btn-primary" id="choose-profile-photo" type="button">${safePhotoUrl(profile) ? 'Change photo' : 'Upload profile photo'}</button>
              <button class="btn btn-secondary" id="remove-profile-photo" type="button" ${safePhotoUrl(profile) ? '' : 'disabled'}>Remove photo</button>
            </div>
            <p class="profile-photo-help">JPG, PNG, or WEBP. Maximum source file: 5 MB. Your photo is optimized and saved directly in Firebase Realtime Database — Firebase Storage is not used.</p>
          ` : `
            <div class="profile-institutional-note">
              <strong>CAS institutional account</strong>
              <span>Administrator pages use the College of Arts and Sciences identity.</span>
            </div>
          `}
        </div>
      </section>

      <section class="panel form-panel profile-details-panel">
        <div class="panel-header"><div><p class="eyebrow">Account information</p><h2>Profile details</h2></div></div>
        <div class="panel-body">
          <form id="profile-form" class="form-stack">
            <div class="form-grid two">
              <label class="field"><span>Full name</span><input name="displayName" value="${escapeHtml(profile.displayName || '')}" required></label>
              <label class="field"><span>Email address</span><input value="${escapeHtml(profile.email || '')}" disabled></label>
            </div>
            <div class="form-grid two">
              <label class="field"><span>${idLabel}</span><input name="${idName}" value="${escapeHtml(idValue || '')}"></label>
              <label class="field"><span>Role</span><input value="${escapeHtml(roleLabel(profile.role))}" disabled></label>
            </div>
            ${studentFields}
            ${adviserDepartment}
            ${adminDepartment}
            <div class="form-actions"><button class="btn btn-primary" type="submit">Save profile</button></div>
          </form>
        </div>
      </section>

      <section class="panel profile-security-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Account security</p>
            <h2>Change password</h2>
          </div>
        </div>
        <div class="panel-body">
          <p class="profile-security-help">
            Update the password used to sign in to the SSU Thesis Portal.
            Use at least 8 characters.
          </p>

          <form id="password-form" class="form-stack profile-password-form">
            <div class="form-grid two">
              <label class="field">
                <span>New password</span>
                <input
                  name="password"
                  type="password"
                  minlength="8"
                  autocomplete="new-password"
                  required
                  placeholder="Enter a new password"
                >
              </label>

              <label class="field">
                <span>Confirm password</span>
                <input
                  name="confirm"
                  type="password"
                  minlength="8"
                  autocomplete="new-password"
                  required
                  placeholder="Re-enter the new password"
                >
              </label>
            </div>

            <div class="form-actions">
              <button class="btn btn-primary" type="submit">Update password</button>
            </div>
          </form>
        </div>
      </section>
    </div>`;
}

function updateVisibleAvatar(profile) {
  const photo = safePhotoUrl(profile);
  const initials = initialsFor(profile);
  document.querySelectorAll('.sidebar-user .avatar, .topbar-profile .avatar').forEach((avatar) => {
    avatar.classList.toggle('has-photo', Boolean(photo));
    avatar.innerHTML = photo
      ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(profile.displayName || 'User')} profile photo">`
      : escapeHtml(initials);
  });

  document.querySelectorAll('.sidebar-user strong, .topbar-profile strong').forEach((node) => {
    node.textContent = profile.displayName || profile.email || 'CAS User';
  });
}

function updateProfilePhotoStage(profile) {
  const stage = document.getElementById('profile-photo-stage');
  if (stage) stage.innerHTML = profilePhotoMarkup(profile, profile.role === 'admin');
  const chooseButton = document.getElementById('choose-profile-photo');
  const removeButton = document.getElementById('remove-profile-photo');
  if (chooseButton) chooseButton.textContent = safePhotoUrl(profile) ? 'Change photo' : 'Upload profile photo';
  if (removeButton) removeButton.disabled = !safePhotoUrl(profile);
  updateVisibleAvatar(profile);
}

export function mount({ profile }) {
  let currentProfile = { ...profile };
  const form = document.getElementById('profile-form');
  const input = document.getElementById('profile-photo-input');
  const chooseButton = document.getElementById('choose-profile-photo');
  const removeButton = document.getElementById('remove-profile-photo');
  const passwordForm = document.getElementById('password-form');

  passwordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = formDataObject(event.currentTarget);
    if (data.password !== data.confirm) {
      toast('Passwords do not match.', 'error');
      return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    setButtonLoading(button, true, 'Updating...');

    try {
      await changePassword(data.password);
      event.currentTarget.reset();
      toast('Password updated successfully.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    setButtonLoading(button, true, 'Saving...');
    try {
      const updated = await updateOwnProfile(currentProfile.uid, formDataObject(event.currentTarget));
      currentProfile = updated;
      store.setState({ profile: updated });
      updateVisibleAvatar(updated);
      document.querySelector('.profile-photo-copy h2')?.replaceChildren(updated.displayName || 'CAS User');
      toast('Profile updated.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });

  chooseButton?.addEventListener('click', () => input?.click());

  input?.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    setButtonLoading(chooseButton, true, 'Uploading...');
    if (removeButton) removeButton.disabled = true;
    try {
      const photo = await uploadOwnProfilePhoto(currentProfile.uid, file);
      currentProfile = {
        ...currentProfile,
        profilePhotoUrl: photo.dataUrl,
        profilePhotoUpdatedAt: photo.updatedAt,
      };
      store.setState({ profile: currentProfile });
      updateProfilePhotoStage(currentProfile);
      toast('Profile photo uploaded to Realtime Database.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      input.value = '';
      setButtonLoading(chooseButton, false);
      if (removeButton) removeButton.disabled = !safePhotoUrl(currentProfile);
    }
  });

  removeButton?.addEventListener('click', async () => {
    if (!safePhotoUrl(currentProfile)) return;
    setButtonLoading(removeButton, true, 'Removing...');
    try {
      await removeOwnProfilePhoto(currentProfile.uid);
      currentProfile = { ...currentProfile, profilePhotoUrl: '', profilePhotoUpdatedAt: null };
      store.setState({ profile: currentProfile });
      updateProfilePhotoStage(currentProfile);
      toast('Profile photo removed.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setButtonLoading(removeButton, false);
    }
  });
}
