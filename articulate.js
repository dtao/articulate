var editors   = {};
var idCounter = 1;

function getContainerElement(node) {
  var element = node;
  while (element && element.nodeType !== 1) {
    element = element.parentNode;
  }
  return element;
}

function getCurrentElement() {
  var selection = window.getSelection();
  return getContainerElement(selection.anchorNode);
}

function getPreviousElement(element) {
  var previousElement = element.previousSibling;
  while (previousElement.nodeType !== 1) {
    previousElement = previousElement.previousSibling;
  }
  return previousElement;
}

function focus(element) {
  doAfterDelay(0, function() {
    element.focus();
  });
}

function dirty() {
  if (!document.title.match(/\*$/)) {
    document.title += '*';
  }
  document.getElementById('save').textContent = 'Save*';
}

function pristine() {
  if (document.title.match(/\*$/)) {
    document.title = document.title.substring(0, document.title.length - 1);
  }
  document.getElementById('save').textContent = 'Save';
}

function blurCurrentElement() {
  var currentElement = getCurrentElement();
  if (currentElement) {
    currentElement.blur();
  }
}

function addClass(element, className) {
  if (element.classList) {
    element.classList.add(className);
    return;
  }

  var classes = element.className.split(/\s+/);
  if (!arrayContains(classes, className)) {
    classes.push(className);
    element.className = classes.join(' ');
  }
}

function removeClass(element, className) {
  if (element.classList) {
    element.classList.remove(className);
    return;
  }

  var classes = element.className.split(/\s+/);
  removeFromArray(classes, className);
  element.className = classes.join(' ');
}

function showElement(element) {
  addClass(element, 'visible');
}

function hideElement(element) {
  removeClass(element, 'visible');
}

function createElement(name, attributes) {
  var element = document.createElement(name);
  for (var attribute in (attributes || {})) {
    element.setAttribute(attribute, attributes[attribute]);
  }
  return element;
}

function ensureListExists(element) {
  if ((/^UL|OL$/).test(element.parentNode.nodeName)) {
    return;
  }

  var list = createElement('UL');
  element.parentNode.insertBefore(list, element);
  list.appendChild(element);
}

function getCssStyle(selector) {
  var stylesheet = document.styleSheets[0];
  var ruleList = stylesheet.cssRules || stylesheet.rules;

  for (var i = 0; i < ruleList.length; ++i) {
    if (ruleList[i].selectorText === selector) {
      return ruleList[i].style;
    }
  }

  return null;
}

function moveAfterList(element) {
  if (!(/^UL|OL$/).test(element.parentNode.nodeName)) {
    return;
  }

  var list = element.parentNode;
  list.parentNode.insertBefore(element, list.nextSibling);
}

function changeElementTo(oldElement, name, attributes) {
  if (name === 'LI') {
    ensureListExists(oldElement);
  } else {
    moveAfterList(oldElement);
  }

  var newElement = createElement(name, attributes);
  newElement.setAttribute('contenteditable', true);
  setElementText(newElement, oldElement.textContent || oldElement.value);
  oldElement.parentNode.replaceChild(newElement, oldElement);
  focus(newElement);

  if (isHeading(name)) {
    updateNav();
  }

  dirty();

  return newElement;
}

function setElementText(element, text) {
  switch (element.nodeName) {
    case 'TEXTAREA':
      element.value = text;
      break;

    default:
      element.textContent = text;
      break;
  }
}

function changeCurrentElementTo(name, attributes) {
  changeElementTo(getCurrentElement(), name, attributes);
}

function changeElementToEditor(element, mode) {
  var textarea = createElement('textarea');
  textarea.value = element.textContent;
  element.parentNode.replaceChild(textarea, element);

  initializeEditor(textarea, mode);

  dirty();
}

function changeCurrentElementToEditor(mode) {
  changeElementToEditor(getCurrentElement(), mode);
}

function changeSelectionTo(element, range, name, attributes) {
  if (!element) {
    return;
  }

  var container = getContainerElement(element);
  var html = container.innerHTML;

  var newElement = createElement(name, attributes);
  newElement.innerHTML = html.substring(range[0], range[1]);

  container.innerHTML = html.substring(0, range[0]) +
    newElement.outerHTML + html.substring(range[1]);

  dirty();
}

function changeCurrentSelectionTo(name, attributes) {
  var selection = window.getSelection();
  changeSelectionTo(selection.anchorNode, getRange(selection), name, attributes);
}

function getRange(selection) {
  var range = getMinMax(selection.anchorOffset, selection.focusOffset);

  // Expand range as necessary in case what's selected includes HTML entities.
  var length = escapeHTML(selection.anchorNode.textContent.substring(range[0], range[1])).length;
  range[1] = range[0] + length;

  // Adjust offsets based on where the current selection is within the parent.
  var offset = getTotalOffset(selection.anchorNode);
  range[0] += offset;
  range[1] += offset;

  return range;
}

function getTotalOffset(element) {
  var offset = 0;
  while (element && element.previousSibling) {
    element = element.previousSibling;
    offset += (element.outerHTML || escapeHTML(element.textContent)).length;
  }
  return offset;
}

function insertNewElement(name, oldElement) {
  oldElement = oldElement || getCurrentElement();
  var newElement = createElement(name, { contenteditable: true });
  oldElement.parentNode.insertBefore(newElement, oldElement.nextSibling);
  focus(newElement);
}

function removeElement(element) {
  var name = element.nodeName;
  var previousElement = getPreviousElement(element);
  element.parentNode.removeChild(element);
  focus(previousElement);
  if (isHeading(name)) {
    updateNav();
  }
}

function removeCurrentElement() {
  removeElement(getCurrentElement());
}

function isHeading(name) {
  return !!name.match(/^h\d$/i);
}

function isEmpty(text) {
  return !!text.match(/^\s*$/);
}

function updateNav() {
  var navList = document.querySelector('nav > ul');
  navList.innerHTML = '';

  var headings = document.querySelectorAll('article > h1, article > h2, article > h3');
  for (var i = 0; i < headings.length; ++i) {
    setIdForHeading(headings[i]);
    addNavListItemForHeading(navList, headings[i]);
  }
}

function initializeEditors() {
  editors = {};
  idCounter = 1;

  var pres = document.querySelectorAll('article > pre');
  for (var i = 0; i < pres.length; ++i) {
    initializeEditor(pres[i], pres[i].getAttribute('data-mode'));
  }
}

function initializeEditor(textarea, mode) {
  if (textarea.nodeName !== 'TEXTAREA') {
    textarea = changeElementTo(textarea, 'TEXTAREA');
  }

  var editor = CodeMirror.fromTextArea(textarea, {
    autofocus: true,
    mode: mode,
    viewportMargin: Infinity
  });

  var editorId = idCounter++;
  editors[editorId] = editor;
  editor.getWrapperElement().setAttribute('data-editor-id', editorId);
}

function setIdForHeading(heading) {
  var text = heading.textContent;
  heading.id = text.replace(/[^\w]/g, '-').toLowerCase();
}

function addItemToList(list, itemText) {
  var listItem = createElement('LI');
  listItem.textContent = itemText;
  list.appendChild(listItem);
}

function addNavListItemForHeading(navList, heading) {
  var item = createElement('LI');
  item.className = heading.nodeName.toLowerCase();
  navList.appendChild(item);

  var link = createElement('A', { href: '#' + heading.id });
  link.textContent = heading.textContent;
  item.appendChild(link);
}

function expandArticle() {
  var articleStyle = getCssStyle('article');
  var width = parseInt(getCssStyle('article').width);
  articleStyle.width = (width + 5) + '%';
}

function contractArticle() {
  var articleStyle = getCssStyle('article');
  var width = parseInt(getCssStyle('article').width);
  articleStyle.width = (width - 5) + '%';
}

function switchTheme(theme) {
  theme = theme || getNextTheme();
  document.body.className = theme;
  localStorage.theme = theme;
}

function getNextTheme() {
  switch (document.body.className) {
    case 'default':
      return 'sky';

    case 'sky':
      return 'strict';

    default:
      return 'default';
  }
}

function notify(message, className, attributes) {
  var notices = document.querySelector('#notices ul');
  var noticeItem = createElement('LI', attributes);
  noticeItem.className = className;
  noticeItem.textContent = message;
  notices.insertBefore(noticeItem, notices.firstChild);

  // Slide the notification in...
  doAfterDelay(0, function() {
    addClass(noticeItem, 'appear');

    if (className === 'error') {
      noticeItem.addEventListener('click', function() {
        notices.removeChild(noticeItem);
      });

    } else {
      // ...leave it for 3 seconds...
      doAfterDelay(3000, function() {

        // ...then blast it off the screen!
        removeClass(noticeItem, 'appear');

        // ...and remove it from the DOM (after blasting it).
        doAfterDelay(500, function() {
          notices.removeChild(noticeItem);
        });
      })
    }
  });
}

// ----- Utils -----

function getMinMax(x, y) {
  return x < y ? [x, y] : [y, x];
}

function escapeHTML(html) {
  // Here's the StackOverflow implementation:
  // http://stackoverflow.com/questions/5251520/how-do-i-escape-some-html-in-javascript

  // var pre = createElement('pre');
  // var text = document.createTextNode(html);
  // pre.appendChild(text);
  // return pre.innerHTML;

  // I'm going to go with something more lightweight (?), though.
  return html.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// I just hate how period is the second argument to setInterval.
function doPeriodically(period, callback) {
  return setInterval(callback, period);
}

// Same with setTimeout!
function doAfterDelay(delay, callback) {
  return setTimeout(callback, delay);
}

function arrayContains(array, element) {
  for (var i = 0; i < array.length; ++i) {
    if (array[i] === element) {
      return true;
    }
  }
  return false;
}

function removeFromArray(array, element) {
  for (var i = array.length - 1; i >= 0; --i) {
    if (array[i] === element) {
      array.splice(i, 1);
    }
  }
}

function isEditing() {
  var element = getCurrentElement();

  while (element) {
    // As soon as we reach the <article>, we're done.
    if (element.nodeName === 'ARTICLE') {
      return true;
    }

    // If we reach <body>, we've gone too far.
    if (element.nodeName === 'BODY') {
      return false;
    }

    element = element.parentNode;
  }

  return false;
}

function isInCodeEditor(e) {
  if (!e.target || e.target.nodeName !== 'TEXTAREA') {
    return false;
  }

  return belongsTo(e.target, 'CodeMirror');
}

function isModalShowing() {
  return !!document.querySelector('.autohide.visible');
}

function getAvailableModes() {
  var modes = Object.keys(CodeMirror.modes);
  for (var i = modes.length - 1; i >= 0; --i) {
    if (modes[i] === 'null') {
      modes.splice(i, 1);
      break;
    }
  }
  return modes;
}

function belongsTo(element, parentClass) {
  var classMatcher = new RegExp('\\b' + parentClass + '\\b');

  while (element.parentNode) {
    if (classMatcher.test(element.parentNode.className)) {
      return true;
    }
    element = element.parentNode;
  }

  return false;
}

function inDevMode() {
  return window.location.hostname === 'localhost';
}

// ----- Boot -----

window.addEventListener('load', function() {
  var article        = document.querySelector('article');
  var shortcutsTable = document.querySelector('#shortcuts table');
  var inputDialog    = document.getElementById('modal-input');
  var inputField     = inputDialog.querySelector('input');
  var blobDialog     = document.getElementById('modal-blob');
  var blobField      = blobDialog.querySelector('textarea');
  var listDialog     = document.getElementById('modal-list');
  var listCaption    = listDialog.querySelector('h1');
  var inputList      = listDialog.querySelector('ul');
  var saveButton     = document.getElementById('save');
  var deleteButton   = document.getElementById('delete');
  var exportButton   = document.getElementById('export');
  var importButton   = document.getElementById('import');

  function getInputFromDialog(dialog, field, caption, callback) {
    field.setAttribute('placeholder', caption);
    showElement(dialog);
    focus(field);

    var handler = function(e) {
      if (e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();

        try {
          hideElement(dialog);

          callback(field.value);

          // Clean up.
          field.removeAttribute('placeholder');
          field.value = '';

        } finally {
          field.removeEventListener('keydown', handler);
        }
      }
    };

    field.addEventListener('keydown', handler);
  }

  function getInput(caption, callback) {
    getInputFromDialog(inputDialog, inputField, caption, callback);
  }

  function getBlob(caption, callback) {
    getInputFromDialog(blobDialog, blobField, caption, callback);
  }

  function getListSelection(caption, list, callback) {
    listCaption.textContent = caption;

    // Be sure the list is empty before proceeding.
    inputList.innerHTML = '';

    for (var i = 0; i < list.length; ++i) {
      addItemToList(inputList, list[i]);
    }

    blurCurrentElement();
    showElement(listDialog);
    focus(listDialog);

    var clickHandler = function(e) {
      if (!e.target || e.target.nodeName !== 'LI') {
        return;
      }

      try {
        hideElement(listDialog);

        var text = e.target.textContent;
        callback(text);

        // Clean up. (It's the OCD in me.)
        listCaption.textContent = '';
        inputList.innerHTML = '';

      } finally {
        Mousetrap.unbind(['up', 'down']);
        listDialog.removeEventListener('click', clickHandler);
        document.removeEventListener('keydown', enterHandler);
      }
    };

    listDialog.addEventListener('click', clickHandler);

    // It seems adding this handler manually is necessary since Mousetrap only
    // lets you bind/unbind one handler per combo.
    var enterHandler = function(e) {
      if (e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();

        var selectedItem = inputList.querySelector('li.selected');

        if (!selectedItem) {
          return;
        }

        try {
          hideElement(listDialog);

          callback(selectedItem.textContent);

          inputList.innerHTML = '';

        } finally {
          Mousetrap.unbind(['up', 'down']);
          listDialog.removeEventListener('click', clickHandler);
          document.removeEventListener('keydown', enterHandler);
        }
      }
    };

    document.addEventListener('keydown', enterHandler);

    bind(false, {
      'up': [function() {
        var selectedItem = inputList.querySelector('li.selected');

        // Start with the last item by default.
        if (!selectedItem) {
          addClass(inputList.lastChild, 'selected');
          return;
        }

        removeClass(selectedItem, 'selected');
        addClass(selectedItem.previousSibling || inputList.lastChild, 'selected');
      }],

      'down': [function() {
        var selectedItem = inputList.querySelector('li.selected');

        // Start with the first item by default.
        if (!selectedItem) {
          addClass(inputList.firstChild, 'selected');
          return;
        }

        removeClass(selectedItem, 'selected');
        addClass(selectedItem.nextSibling || inputList.firstChild, 'selected');
      }]
    });
  }

  function getConfirmation(caption, callback) {
    getListSelection(caption, ['Yes', 'No'], function(input) {
      if (input === 'Yes') {
        callback();
      }
    });
  }

  function startNewArticle() {
    getInput('Enter a name for your new article', function(input) {
      if (isEmpty(input)) {
        notify('Name is required!', 'error');
        return;
      }

      localStorage.lastArticleName = input;
      article.innerHTML = '<h1 contenteditable="true">' + escapeHTML(input) + '</h1>';
      updateNav();
    });
  }

  function getSavedArticleNames() {
    var articles = JSON.parse(localStorage.articles || '{}');
    return Object.keys(articles);
  }

  function getArticle(articleName) {
    var articles = JSON.parse(localStorage.articles || '{}');
    return articles[articleName];
  }

  function getArticleHtml() {
    var clone = article.cloneNode(true);
    var existingEditors = clone.querySelectorAll('.CodeMirror');
    for (var i = 0; i < existingEditors.length; ++i) {
      replaceEditor(existingEditors[i]);
    }
    return clone.innerHTML;
  }

  function deleteArticle(articleName) {
    var articles = JSON.parse(localStorage.articles || '{}');
    delete articles[articleName];
    localStorage.articles = JSON.stringify(articles);
    notify('"' + articleName + '" deleted!');
  }

  function replaceEditor(wrapper) {
    var editorId = wrapper.getAttribute('data-editor-id');
    var editor = editors[editorId];
    var textarea = wrapper.previousSibling;
    var pre = createElement('PRE', {
      'data-mode': editor.getDoc().getMode()
    });
    pre.textContent = editor.getValue();

    var parent = wrapper.parentNode;
    parent.replaceChild(pre, wrapper);
    parent.removeChild(textarea);
  }

  function saveArticle(articleName) {
    var articles = JSON.parse(localStorage.articles || '{}');
    articles[articleName] = getArticleHtml();
    localStorage.articles = JSON.stringify(articles);
    localStorage.lastArticleName = articleName;

    pristine();
    notify('Saved!');
  }

  function save() {
    var lastArticleName = localStorage.lastArticleName;

    if (lastArticleName) {
      saveArticle(lastArticleName);
      return;
    }

    getInput('Enter a name for this article', function(input) {
      saveArticle(input);
      return;
    });
  }

  function importArticle(savedArticle) {
    article.innerHTML = savedArticle;
    updateNav();
    initializeEditors();
  }

  function loadArticle(articleName) {
    var savedArticle = getArticle(articleName);
    if (!savedArticle) {
      notify("Article doesn't exist!", 'error');
      return;
    }

    importArticle(savedArticle);
    document.title = articleName;
    localStorage.lastArticleName = articleName;
  }

  function load() {
    if (!localStorage) {
      return;
    }

    if (localStorage.theme) {
      switchTheme(localStorage.theme);
    }

    var lastArticleName = localStorage.lastArticleName;
    if (lastArticleName) {
      loadArticle(lastArticleName);
    } else {
      updateNav();
    }
  }

  function openArticle() {
    getListSelection('Select an article', getSavedArticleNames(), function(input) {
      loadArticle(input);
    });
  }

  function bind(applyGlobally, callbacks) {
    for (var sequence in callbacks) {
      (function(args) {
        var callback    = args.pop();
        var description = args.pop();
        var force       = args.pop();

        Mousetrap[applyGlobally ? 'bindGlobal' : 'bind'](sequence, function(e) {
          if (applyGlobally && !force && !isEditing()) {
            return;
          }

          try {
            callback.apply(this, arguments);

          } finally {
            if (!e.keepDefault) {
              e.preventDefault();
            }
          }
        });

        if (!description) {
          return;
        }

        // Populate the shortcuts list
        var shortcutEntry = createElement('tr');
        shortcutsTable.appendChild(shortcutEntry);

        var shortcutSequence = createElement('th');
        shortcutSequence.innerHTML = '<kbd>' + sequence + '</kbd>';
        shortcutEntry.appendChild(shortcutSequence);

        var shortcutDescription = createElement('td');
        shortcutDescription.textContent = description;
        shortcutEntry.appendChild(shortcutDescription);

      }(callbacks[sequence]));
    }
  }

  bind(true, {
    'ctrl+enter': ['inserts a new element before the current one', function(e) {
      var currentElement = getCurrentElement();
      insertNewElement(currentElement.nodeName, currentElement.previousSibling);
    }],

    'enter': ['creates a new element', function(e) {
      if (isInCodeEditor(e) || isModalShowing()) {
        return;
      }

      if (!e.shiftKey) {
        insertNewElement(getCurrentElement().nodeName);
      }
    }],

    'backspace': ['deletes the current element (if empty)', function(e) {
      if (isInCodeEditor(e)) {
        return;
      }

      if (getCurrentElement().textContent === '') {
        removeCurrentElement();
        return;
      }

      e.keepDefault = true;
    }],

    'ctrl+1': ['changes the current element to a top-level heading (<h1>)', function() {
      changeCurrentElementTo('H1');
    }],

    'ctrl+2': ['changes the current element to a subheading (<h2>)', function() {
      changeCurrentElementTo('H2');
    }],

    'ctrl+3': ['changes the current element to a secondary subheading (<h3>)', function() {
      changeCurrentElementTo('H3');
    }],

    'ctrl+p': ['changes the current element to a paragraph (<p>)', function() {
      changeCurrentElementTo('P');
    }],

    'ctrl+l': ['changes the current element to a list item (<li>)', function() {
      changeCurrentElementTo('LI');
    }],

    'ctrl+q': ['changes the current element to a blockquote (<blockquote>)', function() {
      changeCurrentElementTo('BLOCKQUOTE');
    }],

    'ctrl+m': ['creates a code editor from the current element', function() {
      var currentElement = getCurrentElement();
      getListSelection('Select a language mode', getAvailableModes(), function(mode) {
        changeElementToEditor(currentElement, mode);
      });
    }],

    'ctrl+i': ['makes the selected text italic', function() {
      changeCurrentSelectionTo('EM');
    }],

    'ctrl+b': ['makes the selected text bold', function() {
      changeCurrentSelectionTo('STRONG');
    }],

    'ctrl+`': ['marks the selected text as source code (<code>)', function() {
      changeCurrentSelectionTo('CODE');
    }],

    'ctrl+k': ['marks the selected text as a keyboard key (<kbd>)', function() {
      changeCurrentSelectionTo('KBD');
    }],

    'ctrl+a': ['add a hyperlink (<a>)', function(e) {
      if (isInCodeEditor(e)) {
        return;
      }

      var selection = window.getSelection();
      var anchorNode = selection.anchorNode;
      var range = getRange(selection);

      getInput('Enter a URL', function(href) {
        changeSelectionTo(anchorNode, range, 'A', { href: href });
      });
    }],

    'ctrl+g': ['add a graphic (<img>)', function() {
      var element = getCurrentElement();

      getInput('Enter the URL of an image', function(src) {
        changeElementTo(element, 'IMG', { src: src });
      });
    }],

    'esc': [true, null, function() {
      var autohideElements = document.querySelectorAll('.autohide');
      for (var i = 0; i < autohideElements.length; ++i) {
        hideElement(autohideElements[i]);
      }

      var currentElement = getCurrentElement();
      if (currentElement) {
        currentElement.blur();

        if (isEmpty(currentElement.textContent)) {
          removeElement(currentElement);
        }
      }
    }],

    'ctrl+=': [true, 'increases the width of the article', function() {
      expandArticle();
    }],

    'ctrl+-': [true, 'decreases the width of the article', function() {
      contractArticle();
    }],

    'ctrl+t': [true, 'switches the current theme', function() {
      switchTheme();
    }],

    'ctrl+n': [true, 'starts a new article', function() {
      startNewArticle();
    }],

    'ctrl+o': [true, 'opens a saved article', function() {
      openArticle();
    }],

    'ctrl+s': [true, 'saves the article locally', function() {
      save();
    }],

    'ctrl+shift+s': [true, 'saves a copy of the current article', function() {
      getInput('Enter a new name for the article', function(input) {
        if (isEmpty(input)) {
          notify('Name is required!', 'error');
          return;
        }

        articleName = input;
        save();
      });
    }]
  });

  // Whenever the user makes changes...
  article.addEventListener('input', function(e) {

    // ...mark the Save button...
    dirty();

    // ...and update the nav menu (if applicable).
    if (isHeading(e.target.nodeName)) {
      updateNav();
    }
  });

  // Allow the user to save what he/she's written to localStorage.
  saveButton.addEventListener('click', function() {
    save();
  });

  // Allow the user to delete the current work.
  deleteButton.addEventListener('click', function() {
    if (!articleName) {
      return;
    }

    getConfirmation('Really delete "' + articleName + '"?', function() {
      deleteArticle(articleName);
      articleName = null;
    });
  });

  exportButton.addEventListener('click', function() {
    showElement(blobDialog);
    blobField.value = getArticleHtml();
    focus(blobField);
    blobField.select();
  });

  importButton.addEventListener('click', function() {
    getBlob('Paste some HTML here.', function(input) {
      importArticle(input);
      dirty();
    });
  });

  window.addEventListener('error', function(e) {
    var message = e.message;
    if (e.lineNumber || e.lineno) {
      message += ': ' + (e.lineNumber || e.lineno);
    }

    notify(message, 'error');
  });

  // Load any work-in-progress the user saved locally.
  load();

  // Helpful stuff for local development
  if (inDevMode()) {
    doPeriodically(500, function() {
      var selection = window.getSelection();
      document.getElementById('anchor-offset').textContent = selection.anchorOffset;
      document.getElementById('focus-offset').textContent = selection.focusOffset;
      document.getElementById('total-offset').textContent = getTotalOffset(selection.anchorNode);
    });
  }
});
