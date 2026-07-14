package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Repository for {@link Company} entities.
 *
 * <p>The MVP uses this repository to find or create the default company assigned to shift sessions.</p>
 */
public interface CompanyRepository extends JpaRepository<Company, Long> {

	/**
	 * Finds the first company with the given name.
	 *
	 * @param name company name to search for
	 * @return matching company when present
	 */
	Optional<Company> findFirstByName(String name);
}
