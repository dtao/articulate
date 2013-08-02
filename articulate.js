function getCurrentElement() {
  var selection = window.getSelection();
  var element = selection.anchorNode;

  while (element.nodeType !== 1) {
    element = element.parentNode;
  }

  return element;
}

function focus(element) {
  setTimeout(function() { element.focus(); }, 0);
}

function showElement(element) {
  element.style.display = 'block';
}

function hideElement(element) {
  element.style.display = 'none';
}

function ensureListExists(element) {
  if ((/^UL|OL$/).test(element.parentNode.nodeName)) {
    return;
  }

  var list = document.createElement('UL');
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

function changeElementTo(oldElement, name) {
  if (name === 'LI') {
    ensureListExists(oldElement);
  } else {
    moveAfterList(oldElement);
  }

  var newElement = document.createElement(name);
  newElement.textContent = oldElement.textContent;
  newElement.setAttribute('contenteditable', true);
  oldElement.parentNode.replaceChild(newElement, oldElement);
  focus(newElement);
}

// This isn't working at the moment.
// function changeSelectionTo(name) {
//   var selection = window.getSelection();
//   var range = getMinMax(selection.anchorOffset, selection.focusOffset);
//   var html = getCurrentElement().innerHTML;

//   getCurrentElement().innerHTML = [
//     html.substring(0, range[0]),
//     '<' + name + '>',
//     html.substring(range[0], range[1]),
//     '</' + name + '>',
//     html.substring(range[1])
//   ].join('');
// }

function changeCurrentElementTo(name) {
  changeElementTo(getCurrentElement(), name);
}

function createNewElement(name) {
  var oldElement = getCurrentElement();
  var newElement = document.createElement(name);
  newElement.setAttribute('contenteditable', true);
  oldElement.parentNode.insertBefore(newElement, oldElement.nextSibling);
  focus(newElement);
}

function removeElement(element) {
  var previousElement = element.previousSibling;
  element.parentNode.removeChild(element);
  focus(previousElement);
}

function removeCurrentElement() {
  removeElement(getCurrentElement());
}

function expandArticle() {
  var articleStyle = getCssStyle('article');
  var width = parseInt(getCssStyle('article').width);
  articleStyle.width = (width + 100) + 'px';
}

function contractArticle() {
  var articleStyle = getCssStyle('article');
  var width = parseInt(getCssStyle('article').width);
  articleStyle.width = (width - 100) + 'px';
}

// Utils
function getMinMax(x, y) {
  return x < y ? [x, y] : [y, x];
}

window.addEventListener('load', function() {
  function bind(callbacks) {
    for (var sequence in callbacks) {
      (function(callback) {
        Mousetrap.bindGlobal(sequence, function(e) {
          var cancel = true;
          try {
            cancel = !callback.apply(this, arguments);
          } finally {
            if (cancel) {
              e.preventDefault();
            }
          }
        });
      }(callbacks[sequence]));
    }
  }

  bind({
    'enter': function(e) {
      if (!e.shiftKey) {
        createNewElement(getCurrentElement().nodeName);
      }
    },

    'backspace': function() {
      if (getCurrentElement().textContent === '') {
        removeCurrentElement();
      }
      return true;
    },

    'ctrl+1': function() {
      changeCurrentElementTo('H1');
    },

    'ctrl+2': function() {
      changeCurrentElementTo('H2');
    },

    'ctrl+3': function() {
      changeCurrentElementTo('H3');
    },

    'ctrl+p': function() {
      changeCurrentElementTo('P');
    },

    'ctrl+l': function() {
      changeCurrentElementTo('LI');
    },

    'ctrl+=': function() {
      expandArticle();
    },

    'ctrl+-': function() {
      contractArticle();
    }

    // Let's not worry about these just yet.
    // 'ctrl+i': function() {
    //   changeSelectionTo('EM');
    // },

    // 'ctrl+b': function() {
    //   changeSelectionTo('STRONG');
    // }
  });

  var links = document.querySelectorAll('a[href^="#"]');
  for (var i = 0; i < links.length; ++i) {
    links[i].addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var href = this.getAttribute('href');
      showElement(document.querySelector(href));
    });
  }

  document.addEventListener('click', function(e) {
    var elementsToHide = document.querySelectorAll('.auto-hide');
    for (var i = 0; i < elementsToHide.length; ++i) {
      if (elementsToHide[i] !== e.target) {
        hideElement(elementsToHide[i]);
      }
    }
  });
});

window.addEventListener('error', function(msg) {
  alert('Error! ' + msg.message);
});

setInterval(function() {
  var aside = document.getElementById('selection');
  var selection = window.getSelection();
  aside.textContent = 'Anchor offset: ' + selection.anchorOffset + ', focus offset: ' + selection.focusOffset;
}, 500);
