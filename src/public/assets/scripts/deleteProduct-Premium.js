const eliminarBotones = document.querySelectorAll(".eliminar-producto");

eliminarBotones.forEach((enlace) => {
  enlace.addEventListener("click", function (event) {
    event.preventDefault();

    const productId = this.getAttribute("data-product-id");

    fetch(`/api/products/premium/${productId}`, {
      method: "DELETE",
    })
      .then((response) => {
        if (response.status === 200) {
          window.location.href = "/DBproducts-Premium";
        } else {
          // Manejar errores de eliminación si es necesario
        }
      })
      .catch((error) => {         
      });
  });
});

/*

const eliminarBotones = document.querySelectorAll(".eliminar-producto");

eliminarBotones.forEach((enlace) => {
  enlace.addEventListener("click", function (event) {
    event.preventDefault();

    const productId = this.getAttribute("data-product-id");

    fetch(`/api/products/${productId}`, {
      method: "DELETE",
    })
      .then((response) => {
        if (response.status === 200) {
          window.location.href = "/DBproducts";
        } else {
        }
      })
      .catch((error) => {});
  });
});
*/
