// js/logs.js
document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token"); // recupera token do login
    const res = await fetch("/auth/logs", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  
    const logs = await res.json();
    const tbody = document.querySelector("#tabelaLogs tbody");
  
    logs.forEach(log => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${new Date(log.data).toLocaleString()}</td>
        <td>${log.usuario}</td>
        <td>${log.modulo}</td>
        <td>${log.acao}</td>
        <td>${log.detalhe}</td>
      `;
      tbody.appendChild(row);
    });
  });
  