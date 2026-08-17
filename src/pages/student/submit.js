import { pageHeader } from '../../components/ui.js';
import { getSystemSettings } from '../../services/settings.service.js';
import { submitNewThesis } from '../../services/thesis.service.js';
import { getSubmissionAdvisers } from '../../services/user.service.js';
import { escapeHtml, formDataObject, setButtonLoading } from '../../utils/dom.js';
import { toast } from '../../components/toast.js';
import { icon } from '../../components/icons.js';

const currentYear = new Date().getFullYear();

function yearOptions(selectedYear = currentYear) {
  const years = [];
  for (let year = currentYear + 1; year >= currentYear - 10; year -= 1) years.push(year);
  return years
    .map((year) => `<option value="${year}" ${Number(selectedYear) === year ? 'selected' : ''}>${year}</option>`)
    .join('');
}

function adviserOptions(advisers) {
  return advisers.map((adviser) => {
    const department = adviser.department || 'College of Arts and Sciences';
    return `<option
      value="${escapeHtml(adviser.id)}"
      data-name="${escapeHtml(adviser.displayName || 'Thesis Adviser')}"
      data-employee="${escapeHtml(adviser.employeeId || '')}"
      data-department="${escapeHtml(department)}"
    >${escapeHtml(adviser.displayName || 'Thesis Adviser')}${adviser.employeeId ? ` — ${escapeHtml(adviser.employeeId)}` : ''}</option>`;
  }).join('');
}

export async function render({ profile }) {
  const [settings, advisers] = await Promise.all([
    getSystemSettings().catch(() => ({ submissionOpen: true, academicYear: '' })),
    getSubmissionAdvisers().catch(() => []),
  ]);

  if (!settings.submissionOpen) {
    return `${pageHeader('New Thesis Submission', 'Submit a new research manuscript for adviser review.')}
      <section class="panel form-panel professional-submit-panel">
        <div class="panel-body">
          <div class="notice-box warning">
            <strong>Research submission is currently closed.</strong>
            <p>Please contact the thesis administrator if you need assistance.</p>
          </div>
        </div>
      </section>`;
  }

  if (!advisers.length) {
    return `${pageHeader('New Thesis Submission', 'Submit a new research manuscript for adviser review.')}
      <section class="panel form-panel professional-submit-panel">
        <div class="panel-body">
          <div class="notice-box warning">
            <strong>No active thesis advisers are available.</strong>
            <p>The administrator must create and activate at least one adviser account before students can submit research.</p>
          </div>
          <div class="form-actions" style="margin-top:18px">
            <a class="btn btn-secondary" href="#/dashboard">Return to dashboard</a>
            <a class="btn btn-primary" href="#/student/theses">My theses</a>
          </div>
        </div>
      </section>`;
  }

  const academicYear = settings.academicYear || `${currentYear}-${currentYear + 1}`;

  return `${pageHeader(
    'New Thesis Submission',
    'Complete the research record, select your thesis adviser, and submit your manuscript for review.'
  )}

    <div class="pro-submit-shell">
      <ol class="pro-submit-steps" aria-label="Thesis publication workflow">
        <li class="active"><span>1</span><div><strong>Student Submission</strong><small>Research metadata and manuscript</small></div></li>
        <li><span>2</span><div><strong>Adviser Review</strong><small>Review, revision, or approval</small></div></li>
        <li><span>3</span><div><strong>Admin Approval</strong><small>Final institutional review</small></div></li>
        <li><span>4</span><div><strong>Published</strong><small>Visible in the public repository</small></div></li>
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
              <h2>Thesis Adviser</h2>
              <p>Select the active adviser who will receive and review this specific research submission.</p>
            </div>
          </header>

          <div class="pro-submit-card-body adviser-selection-grid">
            <label class="field">
              <span>Choose thesis adviser <b>*</b></span>
              <select id="adviser-select" name="adviserUid" required>
                <option value="">Select an active adviser</option>
                ${adviserOptions(advisers)}
              </select>
              <small>Only active adviser accounts created by the administrator are listed.</small>
            </label>

            <aside class="selected-adviser-card empty" id="selected-adviser-card" aria-live="polite">
              <div class="selected-adviser-avatar">${icon('user', 21)}</div>
              <div>
                <small>Selected adviser</small>
                <strong id="selected-adviser-name">No adviser selected</strong>
                <span id="selected-adviser-meta">Choose an adviser from the list.</span>
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
              <p>Upload the manuscript that will be reviewed by your selected adviser.</p>
            </div>
          </header>

          <div class="pro-submit-card-body">
            <div class="manuscript-dropzone" id="manuscript-dropzone" role="button" tabindex="0" aria-label="Choose PDF or DOCX manuscript">
              <input id="thesis-file" type="file" accept=".pdf,.docx" hidden>
              <div class="dropzone-icon">${icon('upload', 25)}</div>
              <div class="dropzone-copy">
                <strong>Drop your manuscript here</strong>
                <span>or <button type="button" class="dropzone-browse" id="browse-file">browse from your device</button></span>
                <small>PDF or DOCX only · Maximum 10 MB · File signature validated before upload</small>
              </div>
            </div>

            <div class="selected-file-card" id="selected-file-card" hidden>
              <div class="selected-file-icon">${icon('file', 20)}</div>
              <div class="selected-file-copy"><strong id="selected-file-name"></strong><span id="selected-file-meta"></span></div>
              <button class="icon-button danger" type="button" id="remove-file" aria-label="Remove selected manuscript">×</button>
            </div>

            <label class="field pro-field-full">
              <span>Submission note <em>(optional)</em></span>
              <textarea name="note" rows="3" maxlength="1000" placeholder="Add a short message or instruction for your selected adviser"></textarea>
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
            <span>Submission sends this research directly to the selected adviser. Publication requires adviser approval followed by final administrator approval.</span>
          </div>
          <div class="form-actions professional-form-actions">
            <a class="btn btn-secondary" href="#/student/theses">Cancel</a>
            <button class="btn btn-primary pro-submit-button" type="submit">${icon('arrow', 17)} Submit to adviser</button>
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
  const adviserSelect = document.getElementById('adviser-select');
  const adviserCard = document.getElementById('selected-adviser-card');
  const adviserName = document.getElementById('selected-adviser-name');
  const adviserMeta = document.getElementById('selected-adviser-meta');
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

  adviserSelect?.addEventListener('change', () => {
    const option = adviserSelect.selectedOptions[0];
    if (!option?.value) {
      adviserCard.classList.add('empty');
      adviserName.textContent = 'No adviser selected';
      adviserMeta.textContent = 'Choose an adviser from the list.';
      return;
    }
    adviserCard.classList.remove('empty');
    adviserName.textContent = option.dataset.name || option.textContent.trim();
    const details = [option.dataset.department, option.dataset.employee ? `Employee ID: ${option.dataset.employee}` : '']
      .filter(Boolean)
      .join(' · ');
    adviserMeta.textContent = details || 'Active thesis adviser';
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
      toast(`Research submitted to ${thesis.adviserName} for review.`, 'success');
      location.hash = `#/student/thesis/${thesis.id}`;
    } catch (error) {
      toast(error.message || 'Unable to submit research.', 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });
}
