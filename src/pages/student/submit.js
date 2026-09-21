import { pageHeader } from '../../components/ui.js';
import { getSystemSettings } from '../../services/settings.service.js';
import { submitNewThesis } from '../../services/thesis.service.js';
import { escapeHtml, formDataObject, setButtonLoading } from '../../utils/dom.js';
import { toast } from '../../components/toast.js';
import { icon } from '../../components/icons.js';
import { APP_CONFIG } from '../../config/app.config.js';

const currentYear = new Date().getFullYear();
const maxFileSizeMb = Math.round(APP_CONFIG.maxFileSizeBytes / (1024 * 1024));

function yearOptions(selectedYear = currentYear) {
  const years = [];
  for (let year = currentYear + 1; year >= currentYear - 10; year -= 1) years.push(year);
  return years
    .map((year) => `<option value="${year}" ${Number(selectedYear) === year ? 'selected' : ''}>${year}</option>`)
    .join('');
}

export async function render({ profile }) {
  const settings = await getSystemSettings().catch(() => ({ submissionOpen: true, academicYear: '' }));
  const researchInstructorUid = String(profile.researchInstructorUid || profile.adviserUid || '');
  const researchInstructorName = String(profile.researchInstructorName || profile.adviserName || '');

  if (!settings.submissionOpen) {
    return `${pageHeader('New Thesis Submission', 'Submit a new research manuscript for Research Instructor review.')}
      <section class="panel form-panel professional-submit-panel">
        <div class="panel-body">
          <div class="notice-box warning">
            <strong>Research submission is currently closed.</strong>
            <p>Please contact the thesis administrator if you need assistance.</p>
          </div>
        </div>
      </section>`;
  }

  if (!researchInstructorUid || !researchInstructorName) {
    return `${pageHeader('New Thesis Submission', 'Submit a new research manuscript for Research Instructor review.')}
      <section class="panel form-panel professional-submit-panel">
        <div class="panel-body">
          <div class="notice-box warning">
            <strong>No Research Instructor is assigned to your student account.</strong>
            <p>Your Research Instructor must be selected during student registration. Contact the administrator if your account needs correction.</p>
          </div>
          <div class="form-actions" style="margin-top:18px">
            <a class="btn btn-secondary" href="#/dashboard">Return to dashboard</a>
            <a class="btn btn-primary" href="#/student/theses">My thesis records</a>
          </div>
        </div>
      </section>`;
  }

  const academicYear = settings.academicYear || `${currentYear}-${currentYear + 1}`;

  return `${pageHeader(
    'New Thesis Submission',
    'Complete the research record and submit your manuscript to the Research Instructor assigned to your student account.'
  )}

    <div class="pro-submit-shell">
      <ol class="pro-submit-steps" aria-label="Thesis submission workflow">
        <li class="active"><span>1</span><div><strong>Student Submission</strong><small>Research metadata and manuscript</small></div></li>
        <li><span>2</span><div><strong>Research Instructor Review</strong><small>Review, revision, or approval</small></div></li>
        <li><span>3</span><div><strong>Program Chair</strong><small>Program monitoring only</small></div></li>
        <li><span>4</span><div><strong>Admin Approval</strong><small>Final institutional decision</small></div></li>
        <li><span>5</span><div><strong>Repository</strong><small>Approved thesis publication</small></div></li>
      </ol>

      <form id="submit-form" class="pro-submit-form" novalidate>
        <section class="pro-submit-card">
          <header class="pro-submit-card-head">
            <div class="pro-section-icon">${icon('file', 19)}</div>
            <div>
              <span class="pro-section-kicker">Section 01</span>
              <h2>Research Information</h2>
              <p>Provide the official metadata that will be used for review, indexing, search, and publication.</p>
            </div>
          </header>

          <div class="pro-submit-card-body">
            <label class="field pro-field-full">
              <span>Thesis title <b>*</b></span>
              <input name="title" maxlength="300" required placeholder="Enter the complete research title">
              <small>Use the final or working research title. Avoid typing the title in all capital letters.</small>
            </label>

            <div class="pro-researcher-block">
              <div class="pro-block-heading">
                <div><strong>Researchers / Authors</strong><small>The registered student is automatically listed as the primary researcher.</small></div>
                <button class="btn btn-secondary btn-sm" type="button" id="add-researcher">${icon('plus', 15)} Add researcher</button>
              </div>

              <div class="researcher-list" id="researcher-list">
                <div class="researcher-row primary" data-primary="true">
                  <div class="researcher-number">1</div>
                  <label class="field">
                    <span>Primary researcher</span>
                    <input class="researcher-name" value="${escapeHtml(profile.displayName || '')}" readonly>
                  </label>
                  <span class="researcher-role">Account owner</span>
                </div>
              </div>
              <input type="hidden" name="authors" id="authors-hidden" value="${escapeHtml(profile.displayName || '')}">
            </div>

            <label class="field pro-field-full">
              <span>Abstract <b>*</b></span>
              <textarea name="abstract" id="abstract-input" rows="8" maxlength="5000" required placeholder="Provide the complete research abstract"></textarea>
              <div class="field-meta"><small>This abstract becomes public repository metadata after publication.</small><small><span id="abstract-count">0</span>/5000</small></div>
            </label>

            <label class="field pro-field-full">
              <span>Keywords <b>*</b></span>
              <input name="keywords" maxlength="500" required placeholder="Example: information system, thesis repository, Firebase">
              <small>Separate keywords with commas. Use specific terms that improve research discovery.</small>
            </label>
          </div>
        </section>

        <section class="pro-submit-card">
          <header class="pro-submit-card-head">
            <div class="pro-section-icon">${icon('repository', 19)}</div>
            <div>
              <span class="pro-section-kicker">Section 02</span>
              <h2>Academic Information</h2>
              <p>Your program and college are taken from your student account to keep repository records consistent.</p>
            </div>
          </header>

          <div class="pro-submit-card-body">
            <div class="form-grid two">
              <label class="field">
                <span>Program</span>
                <input name="program" value="${escapeHtml(profile.program || '')}" readonly required>
                <small>Program is controlled by your registered CAS student profile.</small>
              </label>
              <label class="field">
                <span>College / Department</span>
                <input name="department" value="${escapeHtml(profile.department || 'College of Arts and Sciences')}" readonly required>
              </label>
            </div>

            <div class="form-grid two">
              <label class="field">
                <span>Research year <b>*</b></span>
                <select name="year" required>${yearOptions(currentYear)}</select>
              </label>
              <label class="field">
                <span>Academic year <b>*</b></span>
                <input name="academicYear" value="${escapeHtml(academicYear)}" maxlength="20" required placeholder="Example: 2026-2027">
              </label>
            </div>
          </div>
        </section>

        <section class="pro-submit-card">
          <header class="pro-submit-card-head">
            <div class="pro-section-icon adviser">${icon('users', 19)}</div>
            <div>
              <span class="pro-section-kicker">Section 03</span>
              <h2>Assigned Research Instructor</h2>
              <p>Your Research Instructor was selected during student account creation and cannot be changed from this submission form.</p>
            </div>
          </header>

          <div class="pro-submit-card-body adviser-selection-grid">
            <label class="field">
              <span>Research Instructor</span>
              <input value="${escapeHtml(researchInstructorName)}" readonly>
              <small>Assigned to your registered program: ${escapeHtml(profile.program || 'Program not recorded')}.</small>
            </label>

            <aside class="selected-adviser-card" aria-live="polite">
              <div class="selected-adviser-avatar">${icon('user', 21)}</div>
              <div>
                <small>Account assignment</small>
                <strong>${escapeHtml(researchInstructorName)}</strong>
                <span>The system automatically routes this submission to your Research Instructor.</span>
              </div>
            </aside>
          </div>
        </section>

        <section class="pro-submit-card">
          <header class="pro-submit-card-head">
            <div class="pro-section-icon upload">${icon('upload', 19)}</div>
            <div>
              <span class="pro-section-kicker">Section 04</span>
              <h2>Manuscript Upload</h2>
              <p>Upload the manuscript that will be reviewed by your assigned Research Instructor.</p>
            </div>
          </header>

          <div class="pro-submit-card-body">
            <div class="manuscript-dropzone" id="manuscript-dropzone" role="button" tabindex="0" aria-label="Choose PDF or DOCX manuscript">
              <input id="thesis-file" type="file" accept=".pdf,.docx" hidden>
              <div class="dropzone-icon">${icon('upload', 25)}</div>
              <div class="dropzone-copy">
                <strong>Drop your manuscript here</strong>
                <span>or <button type="button" class="dropzone-browse" id="browse-file">browse from your device</button></span>
                <small>PDF or DOCX only · Maximum ${maxFileSizeMb} MB · File signature validated before upload</small>
              </div>
            </div>

            <div class="selected-file-card" id="selected-file-card" hidden>
              <div class="selected-file-icon">${icon('file', 20)}</div>
              <div class="selected-file-copy"><strong id="selected-file-name"></strong><span id="selected-file-meta"></span></div>
              <button class="icon-button danger" type="button" id="remove-file" aria-label="Remove selected manuscript">×</button>
            </div>

            <label class="field pro-field-full">
              <span>Submission note <em>(optional)</em></span>
              <textarea name="note" rows="3" maxlength="1000" placeholder="Add a short message or instruction for your Research Instructor"></textarea>
            </label>

            <div class="upload-progress" id="upload-progress" hidden>
              <div><span>Saving manuscript to Firebase Realtime Database</span><strong id="upload-percent">0%</strong></div>
              <div class="progress-track"><span id="progress-bar"></span></div>
            </div>

          </div>
        </section>

        <footer class="pro-submit-footer">
          <div class="pro-submit-assurance">
            ${icon('check', 17)}
            <span>Submission is sent to your assigned Research Instructor. After instructor approval, the Program Chair can monitor the record and the administrator makes the final approval decision.</span>
          </div>
          <div class="form-actions professional-form-actions">
            <a class="btn btn-secondary" href="#/student/theses">Cancel</a>
            <button class="btn btn-primary pro-submit-button" type="submit">${icon('arrow', 17)} Submit to Research Instructor</button>
          </div>
        </footer>
      </form>
    </div>`;
}

function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function mount({ profile }) {
  const form = document.getElementById('submit-form');
  if (!form) return;

  const researcherList = document.getElementById('researcher-list');
  const addResearcherButton = document.getElementById('add-researcher');
  const authorsHidden = document.getElementById('authors-hidden');
  const abstractInput = document.getElementById('abstract-input');
  const abstractCount = document.getElementById('abstract-count');
  const fileInput = document.getElementById('thesis-file');
  const dropzone = document.getElementById('manuscript-dropzone');
  const browseFileButton = document.getElementById('browse-file');
  const selectedFileCard = document.getElementById('selected-file-card');
  const selectedFileName = document.getElementById('selected-file-name');
  const selectedFileMeta = document.getElementById('selected-file-meta');
  const removeFileButton = document.getElementById('remove-file');
  let selectedFile = null;

  const updateAuthors = () => {
    const names = [...researcherList.querySelectorAll('.researcher-name')]
      .map((input) => input.value.trim())
      .filter(Boolean);
    const unique = [...new Set(names.map((name) => name.replace(/\s+/g, ' ')))];
    authorsHidden.value = unique.join(', ');
    return unique;
  };

  const renumberResearchers = () => {
    [...researcherList.querySelectorAll('.researcher-row')].forEach((row, index) => {
      const number = row.querySelector('.researcher-number');
      if (number) number.textContent = String(index + 1);
    });
  };

  addResearcherButton?.addEventListener('click', () => {
    const count = researcherList.querySelectorAll('.researcher-row').length;
    if (count >= 12) {
      toast('A maximum of 12 researchers can be added to one submission.', 'warning');
      return;
    }

    const row = document.createElement('div');
    row.className = 'researcher-row';
    row.innerHTML = `
      <div class="researcher-number">${count + 1}</div>
      <label class="field">
        <span>Co-researcher</span>
        <input class="researcher-name" maxlength="120" placeholder="Enter complete researcher name" required>
      </label>
      <button class="researcher-remove" type="button" aria-label="Remove researcher">Remove</button>`;
    researcherList.appendChild(row);
    row.querySelector('input')?.focus();
  });

  researcherList?.addEventListener('input', updateAuthors);
  researcherList?.addEventListener('click', (event) => {
    const button = event.target.closest('.researcher-remove');
    if (!button) return;
    button.closest('.researcher-row')?.remove();
    renumberResearchers();
    updateAuthors();
  });


  abstractInput?.addEventListener('input', () => {
    abstractCount.textContent = String(abstractInput.value.length);
  });

  const showFile = (file) => {
    selectedFile = file || null;
    if (!selectedFile) {
      selectedFileCard.hidden = true;
      fileInput.value = '';
      dropzone.classList.remove('has-file');
      return;
    }
    selectedFileName.textContent = selectedFile.name;
    selectedFileMeta.textContent = `${formatBytes(selectedFile.size)} · ${selectedFile.name.split('.').pop()?.toUpperCase() || 'FILE'}`;
    selectedFileCard.hidden = false;
    dropzone.classList.add('has-file');
  };

  browseFileButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    fileInput.click();
  });
  dropzone?.addEventListener('click', () => fileInput.click());
  dropzone?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  fileInput?.addEventListener('change', () => showFile(fileInput.files?.[0] || null));
  removeFileButton?.addEventListener('click', () => showFile(null));

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragging');
    });
  });
  dropzone?.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) showFile(file);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const researchers = updateAuthors();
    if (!researchers.length) {
      toast('Add at least one researcher before submitting.', 'error');
      return;
    }
    if (!selectedFile) {
      toast('Select a PDF or DOCX manuscript before submitting.', 'error');
      dropzone?.focus();
      return;
    }
    if (!form.reportValidity()) return;

    const button = form.querySelector('button[type=submit]');
    const wrap = document.getElementById('upload-progress');
    const percent = document.getElementById('upload-percent');
    const bar = document.getElementById('progress-bar');
    const payload = formDataObject(form);
    payload.authors = researchers.join(', ');

    setButtonLoading(button, true, 'Submitting research...');
    wrap.hidden = false;

    try {
      const thesis = await submitNewThesis(profile, payload, selectedFile, (progress) => {
        percent.textContent = `${progress}%`;
        bar.style.width = `${progress}%`;
      });
      toast(`Research submitted to ${thesis.researchInstructorName || thesis.adviserName} for review.`, 'success');
      location.hash = `#/student/thesis/${thesis.id}`;
    } catch (error) {
      toast(error.message || 'Unable to submit research.', 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });
}
