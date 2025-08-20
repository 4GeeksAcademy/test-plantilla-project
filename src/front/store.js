export const initialStore = () => {
  return {
    message: null,
    token: sessionStorage.getItem("token") || null,  // ⬅️ NUEVO
    todos: [
      { id: 1, title: "Make the bed", background: null },
      { id: 2, title: "Do my homework", background: null }
    ]
  }
}

export default function storeReducer(store, action = {}) {
  switch(action.type){
    case 'set_hello':
      return { ...store, message: action.payload };

    case 'add_task': {
      const { id, color } = action.payload
      return {
        ...store,
        todos: store.todos.map((todo) => (todo.id === id ? { ...todo, background: color } : todo))
      };
    }

    // ⬇️ NUEVO: login/logout
    case 'login_success': {
      const { token } = action.payload;
      sessionStorage.setItem("token", token);
      return { ...store, token };
    }

    case 'logout': {
      sessionStorage.removeItem("token");
      return { ...store, token: null };
    }

    default:
      throw Error('Unknown action.');
  }    
}
