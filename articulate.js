(function(window, document) {

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
    element = element || getCurrentElement();
    var previousElement = element.previousSibling;
    while (previousElement && previousElement.nodeType !== 1) {
      previousElement = previousElement.previousSibling;
    }
    return previousElement;
  }

  function createElement(name, attributes) {
    var element = document.createElement(name);
    for (var attribute in (attributes || {})) {
      element.setAttribute(attribute, attributes[attribute]);
    }
    return element;
  }

  function insertNewElement(name, oldElement) {
    oldElement = oldElement || getCurrentElement();
    var newElement = createElement(name, { contenteditable: true });
    oldElement.parentNode.insertBefore(newElement, oldElement.nextSibling);
    focus(newElement);

    return newElement;
  }

  function changeElementTo(oldElement, name, attributes) {
    if (name === 'LI') {
      ensureListExists(oldElement);
    } else {
      moveAfterList(oldElement);
    }

    var newElement = createElement(name, attributes);
    newElement.setAttribute('contenteditable', true);
    newElement.textContent = oldElement.textContent;
    oldElement.parentNode.replaceChild(newElement, oldElement);
    focus(newElement);

    return newElement;
  }

  function changeCurrentElementTo(name, attributes) {
    return changeElementTo(getCurrentElement(), name, attributes);
  }

  function removeElement(element) {
    var name = element.nodeName;
    var previousElement = getPreviousElement(element);
    element.parentNode.removeChild(element);
    focus(previousElement);
  }

  function removeCurrentElement() {
    removeElement(getCurrentElement());
  }

  function ensureListExists(element) {
    if ((/^UL|OL$/).test(element.parentNode.nodeName)) {
      return;
    }

    var list = createElement('UL');
    element.parentNode.insertBefore(list, element);
    list.appendChild(element);
  }

  function moveAfterList(element) {
    if (!(/^UL|OL$/).test(element.parentNode.nodeName)) {
      return;
    }

    var list = element.parentNode;
    list.parentNode.insertBefore(element, list.nextSibling);
  }

  function shouldMakeContentEditable(element) {
    return !(/^IMG|CANVAS$/).test(element.nodeName);
  }

  function makeContentEditable(element) {
    if ((/^UL|OL$/).test(element.nodeName)) {
      Lazy(element.querySelectorAll('li')).each(makeContentEditable);
      return;
    }

    element.setAttribute('contenteditable', true);
  }

  function focus(element) {
    if (!element) {
      return;
    }

    doAfterDelay(0, function() { element.focus(); });
  }

  // I just hate how delay is the second argument to setTimeout.
  function doAfterDelay(delay, callback) {
    return setTimeout(callback, delay);
  }

  function createBindings(element, dictionary) {
    var mousetrap = window.Mousetrap.wrap(element);

    Lazy(dictionary).each(function(binding, shortcut) {
      var callback    = binding.pop();
      var description = binding.pop();
      var keepDefault = binding.pop();

      mousetrap.bind(shortcut, function(e) {
        try {
          callback.apply(this, arguments);
        } finally {
          if (!e.keepDefault) {
            e.preventDefault();
          }
        }
      });
    });
  }

  function Articulate(element) {
    Lazy(element.children)
      .filter(shouldMakeContentEditable)
      .each(makeContentEditable);

    createBindings(element, {
      'enter': ['creates a new element', function() {
        insertNewElement(getCurrentElement().nodeName);
      }],

      'backspace': ['deletes the current element (if empty)', function(e) {
        if (getCurrentElement().textContent === '') {
          removeCurrentElement();
          return;
        }

        e.keepDefault = true;
      }],

      'esc': ['blurs the currently selected element', function() {
        var currentElement = getCurrentElement();
        if (currentElement) {
          currentElement.blur();
        }
      }],

      'ctrl+1': ['changes the current element to a <h1>', function() {
        changeCurrentElementTo('H1');
      }],

      'ctrl+2': ['changes the current element to a <h2>', function() {
        changeCurrentElementTo('H2');
      }],

      'ctrl+3': ['changes the current element to a <h3>', function() {
        changeCurrentElementTo('H3');
      }],

      'ctrl+p': ['changes the current element to a paragraph (<p>)', function() {
        changeCurrentElementTo('P');
      }],

      'ctrl+l': ['changes the current element to a list item (<li>)', function() {
        changeCurrentElementTo('LI');
      }],

      'ctrl+q': ['changes the current element to a quote (<blockquote>)', function() {
        changeCurrentElementTo('BLOCKQUOTE');
      }],
    });
  }

  window.Articulate = Articulate;

}(window, document));
