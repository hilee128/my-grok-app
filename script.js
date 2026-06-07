const STORAGE_KEY = "my-grok-app-todos";

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const footer = document.getElementById("footer");
const countEl = document.getElementById("count");
const clearBtn = document.getElementById("clear-completed");
const filterBtns = document.querySelectorAll(".filter-btn");

let todos = loadTodos();
let currentFilter = "all";

const checkIcon = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
  <path d="M3 7l3 3 5-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const deleteIcon = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

function loadTodos() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function generateId() {
  return crypto.randomUUID();
}

function getFilteredTodos() {
  switch (currentFilter) {
    case "active":
      return todos.filter((t) => !t.completed);
    case "completed":
      return todos.filter((t) => t.completed);
    default:
      return todos;
  }
}

function render() {
  const filtered = getFilteredTodos();
  list.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.innerHTML =
      currentFilter === "completed"
        ? "<span>🌸</span>완료된 항목이 없어요"
        : currentFilter === "active"
          ? "<span>☁️</span>모든 할 일을 끝냈어요!"
          : "<span>📝</span>첫 번째 할 일을 추가해 보세요";
    list.appendChild(empty);
  } else {
    filtered.forEach((todo) => {
      list.appendChild(createTodoElement(todo));
    });
  }

  const activeCount = todos.filter((t) => !t.completed).length;
  footer.hidden = todos.length === 0;
  countEl.textContent = `${activeCount}개 남음`;
}

function createTodoElement(todo) {
  const li = document.createElement("li");
  li.className = `todo-item${todo.completed ? " completed" : ""}`;
  li.dataset.id = todo.id;

  const checkbox = document.createElement("button");
  checkbox.className = `checkbox${todo.completed ? " checked" : ""}`;
  checkbox.setAttribute("aria-label", todo.completed ? "완료 취소" : "완료");
  checkbox.innerHTML = checkIcon;
  checkbox.addEventListener("click", () => toggleTodo(todo.id));

  const text = document.createElement("span");
  text.className = "todo-text";
  text.textContent = todo.text;
  text.addEventListener("dblclick", () => startEditing(todo.id, text));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.setAttribute("aria-label", "삭제");
  deleteBtn.innerHTML = deleteIcon;
  deleteBtn.addEventListener("click", () => deleteTodo(todo.id));

  li.append(checkbox, text, deleteBtn);
  return li;
}

function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  todos.unshift({ id: generateId(), text: trimmed, completed: false });
  saveTodos();
  render();
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  saveTodos();
  render();
}

function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  saveTodos();
  render();
}

function startEditing(id, textEl) {
  const todo = todos.find((t) => t.id === id);
  if (!todo || todo.completed) return;

  const editInput = document.createElement("input");
  editInput.className = "todo-edit-input";
  editInput.value = todo.text;
  editInput.maxLength = 120;

  textEl.replaceWith(editInput);
  editInput.focus();
  editInput.select();

  const finish = () => {
    const value = editInput.value.trim();
    if (value) {
      todo.text = value;
      saveTodos();
    }
    render();
  };

  editInput.addEventListener("blur", finish);
  editInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") editInput.blur();
    if (e.key === "Escape") {
      editInput.value = todo.text;
      editInput.blur();
    }
  });
}

function setFilter(filter) {
  currentFilter = filter;
  filterBtns.forEach((btn) => {
    const isActive = btn.dataset.filter === filter;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });
  render();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addTodo(input.value);
  input.value = "";
  input.focus();
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
});

clearBtn.addEventListener("click", () => {
  todos = todos.filter((t) => !t.completed);
  saveTodos();
  render();
});

render();